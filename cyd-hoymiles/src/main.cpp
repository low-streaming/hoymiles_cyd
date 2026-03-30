#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <HTTPUpdate.h>
#include <Preferences.h>
#include <TFT_eSPI.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WiFiManager.h>
#include <ESPmDNS.h>


#define CURRENT_VERSION "v1.1.1"
#define UPDATE_URL "https://github.com/low-streaming/hoymiles_cyd/raw/main/cyd-hoymiles/firmware.bin"
#define MANIFEST_URL "https://raw.githubusercontent.com/low-streaming/hoymiles_cyd/main/custom_components/hoymiles_cyd/manifest.json"

Preferences preferences;
TFT_eSPI tft = TFT_eSPI();

// Configuration
char ha_host[64] = "";
char ha_token[256] = "";
bool shouldSaveConfig = false;

// Global Data
float solar_power = 0;
float solar_yield = 0;
float grid_power = 0;
float bat_power = 0;
int bat_soc = 0;
String status_text = "Stabil";
bool is_offline = true;
uint32_t last_update = 0;

void saveConfigCallback() {
  Serial.println("Should save config");
  shouldSaveConfig = true;
}

void wifi_connect() {
  tft.fillScreen(TFT_BLACK);
  tft.setTextColor(TFT_WHITE);
  tft.setCursor(10, 10);
  tft.setTextSize(2);
  tft.println("Starting WiFi...");

  // Open Preferences
  preferences.begin("hoymiles", false);
  String saved_host =
      preferences.getString("ha_host", "homeassistant.local");
  String saved_token = preferences.getString("ha_token", "");
  strncpy(ha_host, saved_host.c_str(), sizeof(ha_host));
  strncpy(ha_token, saved_token.c_str(), sizeof(ha_token));

  WiFiManager wm;
  wm.setSaveConfigCallback(saveConfigCallback);

  WiFiManagerParameter custom_ha_host("host", "HA Host (z.B. 192.168.2.94)",
                                      ha_host, 64);
  WiFiManagerParameter custom_ha_token("token", "HA Long-Lived Token", ha_token,
                                       256);
  wm.addParameter(&custom_ha_host);
  wm.addParameter(&custom_ha_token);

  tft.setCursor(10, 50);
  tft.setTextColor(TFT_YELLOW);
  tft.println("AP: CYD-Hoymiles");

  if (!wm.autoConnect("CYD-Hoymiles")) {
    delay(3000);
    ESP.restart();
  }

  // Always update our variables from parameters
  strncpy(ha_host, custom_ha_host.getValue(), sizeof(ha_host));
  strncpy(ha_token, custom_ha_token.getValue(), sizeof(ha_token));

  if (shouldSaveConfig || strlen(ha_host) > 0) {
    preferences.begin("hoymiles", false);
    preferences.putString("ha_host", ha_host);
    preferences.putString("ha_token", ha_token);
    preferences.end();
    Serial.println("Config Saved to NVS");
  }

  tft.fillScreen(TFT_BLACK);
  tft.setCursor(10, 10);
  tft.println("WiFi Connected!");
  Serial.print("HA Host: ");
  Serial.println(ha_host);
  delay(1000);
}

// UI Colors (Matching Dashboard)
#define COLOR_BG tft.color565(5, 5, 5)
#define COLOR_CARD tft.color565(25, 25, 30)
#define COLOR_ACCENT tft.color565(247, 147, 26) // Orange
#define COLOR_TEXT tft.color565(240, 240, 240)
#define COLOR_DIM tft.color565(120, 120, 130)
#define COLOR_SOLAR tft.color565(255, 217, 0)
#define COLOR_GRID tft.color565(51, 255, 153)
#define COLOR_BAT tft.color565(51, 153, 255)

// Fixed-size card cache — avoids heap allocations (no std::map)
#define MAX_CARDS 8
struct CardCache { int id; float val; };
static CardCache card_cache[MAX_CARDS] = {};
static int card_cache_count = 0;

float* card_cache_get(int id) {
  for (int i = 0; i < card_cache_count; i++)
    if (card_cache[i].id == id) return &card_cache[i].val;
  return nullptr;
}

void card_cache_set(int id, float val) {
  for (int i = 0; i < card_cache_count; i++) {
    if (card_cache[i].id == id) { card_cache[i].val = val; return; }
  }
  if (card_cache_count < MAX_CARDS) {
    card_cache[card_cache_count++] = {id, val};
  }
}

void draw_card(int x, int y, int w, int h, const char *label, float val,
               const char *unit, uint16_t color, bool force = false) {
  int id = x * 1000 + y;
  float* cached = card_cache_get(id);

  if (force || cached == nullptr || *cached != val) {
    if (force) {
      tft.fillRoundRect(x, y, w, h, 8, COLOR_CARD);
      tft.drawRoundRect(x, y, w, h, 8, tft.color565(50, 50, 55));
      tft.setTextColor(COLOR_DIM);
      tft.setTextSize(1);
      tft.setCursor(x + 8, y + 8);
      tft.print(label);
    } else {
      tft.fillRect(x + 5, y + 22, w - 10, 30, COLOR_CARD);
    }

    tft.setTextColor(TFT_WHITE);
    tft.setTextSize(3);
    tft.setCursor(x + 10, y + 25);
    if (val < 10 && val > -10)
      tft.print(val, 1);
    else
      tft.print((int)val);

    tft.setTextSize(1);
    tft.setTextColor(color);
    tft.print(" ");
    tft.print(unit);

    card_cache_set(id, val);
  }
}

void display_update() {
  static bool layout_drawn = false;
  
  if (!layout_drawn) {
    tft.fillScreen(COLOR_BG);
    // Header
    tft.fillRect(0, 0, 320, 35, tft.color565(20, 20, 25));
    tft.setTextColor(COLOR_ACCENT);
    tft.setTextSize(2);
    tft.setCursor(10, 10);
    tft.print("Solar Zentrale");
    
    // Static UI Elements (Visualizer Circle)
    int cx = 160, cy = 135, r = 55;
    tft.drawCircle(cx, cy, r, tft.color565(40, 40, 50));
    tft.drawCircle(cx, cy, r + 1, tft.color565(30, 30, 40));
    
    // Flow Lines (Simple)
    tft.drawLine(65, 110, 120, 100, COLOR_SOLAR);
    
    // Cards Initial
    draw_card(10, 45, 110, 65, "SOLAR", solar_power, "W", COLOR_SOLAR, true);
    draw_card(10, 115, 110, 65, "ERTRAG", solar_yield, "kWh", COLOR_ACCENT, true);
    draw_card(200, 45, 110, 65, "AKKU", bat_soc, "%", COLOR_BAT, true);
    draw_card(200, 115, 110, 65, "HAUS", (solar_power + grid_power - bat_power), "W", COLOR_ACCENT, true);

    layout_drawn = true;
  }

  // Status Indicator
  tft.fillRect(240, 0, 80, 35, tft.color565(20, 20, 25));
  tft.setTextSize(1);
  tft.setCursor(240, 12);
  if (is_offline) {
    tft.setTextColor(TFT_RED);
    tft.print("OFFLINE");
  } else {
    tft.setTextColor(TFT_GREEN);
    tft.print("AKTIV");
  }

  // Grid Pulse Indicator Update
  int cx = 160, cy = 135;
  uint16_t grid_color = (grid_power > 0) ? COLOR_BAT : COLOR_GRID;
  tft.fillCircle(cx, cy, 40, COLOR_CARD);
  tft.drawCircle(cx, cy, 40, grid_color);

  tft.setTextColor(TFT_WHITE);
  tft.setTextSize(2);
  String gStr = String((int)grid_power) + " W";
  int gw = tft.textWidth(gStr);
  tft.setCursor(cx - gw / 2, cy - 7);
  tft.print(gStr);

  tft.setTextSize(1);
  tft.setTextColor(COLOR_DIM);
  const char *grid_txt = (grid_power > 0) ? "BEZUG" : "EXPORT";
  tft.setCursor(cx - tft.textWidth(grid_txt) / 2, cy + 12);
  tft.print(grid_txt);

  // Cards Dynamic Update
  draw_card(10, 45, 110, 65, "SOLAR", solar_power, "W", COLOR_SOLAR);
  draw_card(10, 115, 110, 65, "ERTRAG", solar_yield, "kWh", COLOR_ACCENT);
  draw_card(200, 45, 110, 65, "AKKU", bat_soc, "%", COLOR_BAT);
  draw_card(200, 115, 110, 65, "HAUS", (solar_power + grid_power - bat_power), "W", COLOR_ACCENT);

  // Footer / Status
  tft.fillRect(0, 215, 320, 25, COLOR_BG);
  tft.setTextColor(COLOR_DIM);
  tft.setCursor(10, 220);
  tft.print("REGELUNG: ");
  tft.setTextColor(COLOR_ACCENT);
  tft.print(status_text);

  // Version Info
  tft.setTextColor(COLOR_DIM);
  tft.setTextSize(1);
  tft.setCursor(260, 220);
  tft.print(CURRENT_VERSION);
}

void checkForUpdate() {
  if (WiFi.status() != WL_CONNECTED)
    return;

  Serial.println("Checking for Update...");
  tft.fillScreen(TFT_BLACK);
  tft.setTextColor(TFT_WHITE);
  tft.setCursor(10, 10);
  tft.println("Checking for updates...");

  WiFiClientSecure client;
  client.setInsecure(); // GitHub uses HTTPS
  HTTPClient http;

  http.begin(client, MANIFEST_URL);
  int httpCode = http.GET();

  if (httpCode == 200) {
    String payload = http.getString();
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, payload);

    if (!error) {
      String latest = doc["version"].as<String>();
      Serial.print("Latest version: ");
      Serial.println(latest);

      // Strip leading 'v' from both sides before comparing
      String current = String(CURRENT_VERSION);
      if (current.startsWith("v")) current = current.substring(1);
      if (latest.startsWith("v")) latest = latest.substring(1);
      if (latest != current) {
        Serial.println("New version available! Starting Update...");
        tft.fillScreen(COLOR_BG);
        tft.setTextColor(COLOR_ACCENT);
        tft.setCursor(40, 100);
        tft.setTextSize(2);
        tft.println("NEW UPDATE FOUND!");
        tft.setCursor(40, 130);
        tft.setTextSize(1);
        tft.setTextColor(TFT_WHITE);
        tft.print("Installing: ");
        tft.println(latest);

        tft.fillRect(40, 160, 240, 20, COLOR_CARD);
        tft.drawRect(40, 160, 240, 20, COLOR_DIM);

        // Perform HTTP Update
        httpUpdate.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
        t_httpUpdate_return ret = httpUpdate.update(client, UPDATE_URL);

        switch (ret) {
        case HTTP_UPDATE_FAILED:
          Serial.printf("HTTP_UPDATE_FAILED Error (%d): %s\n",
                        httpUpdate.getLastError(),
                        httpUpdate.getLastErrorString().c_str());
          tft.setCursor(40, 200);
          tft.setTextColor(TFT_RED);
          tft.println("Update Failed! Restarting...");
          delay(3000);
          ESP.restart(); // Heap is corrupted after failed OTA — must restart
        case HTTP_UPDATE_NO_UPDATES:
          Serial.println("HTTP_UPDATE_NO_UPDATES");
          break;
        case HTTP_UPDATE_OK:
          Serial.println("HTTP_UPDATE_OK");
          break;
        }
      } else {
        Serial.println("Firmware is up to date.");
      }
    }
  }
  http.end();
  display_update();
}

String discover_ha_ip() {
  Serial.println("--- Discovery ---");
  Serial.println("Suche Home Assistant via mDNS...");
  
  // 1. Try homeassistant.local directly (standard)
  IPAddress srv = MDNS.queryHost("homeassistant");
  if (srv != IPAddress(0,0,0,0)) {
    Serial.print("Discovery: Found via hostname: ");
    Serial.println(srv.toString());
    return srv.toString();
  }

  // 2. Try to find the _homeassistant._tcp.local service
  Serial.println("Suche _homeassistant._tcp.local...");
  int n = MDNS.queryService("homeassistant", "tcp");
  if (n > 0) {
    Serial.print("Discovery: Found ");
    Serial.print(n);
    Serial.println(" HA services");
    IPAddress ip = MDNS.address(0);
    Serial.print("Discovery: Using service IP: ");
    Serial.println(ip.toString());
    return ip.toString();
  }

  Serial.println("Discovery: FAILED");
  return "";
}

void fetch_ha_data() {
  if (WiFi.status() != WL_CONNECTED)
    return;

  String url = String(ha_host);
  if (url == "homeassistant.local" || url.length() < 5) {
    String discovered = discover_ha_ip();
    if (discovered.length() > 0) {
      url = discovered;
    } else {
      url = "homeassistant.local"; // Fallback
    }
  }

  // Fix URL Scheme
  if (!url.startsWith("http")) {
    url = "http://" + url;
  }

  // Only append :8123 if NO port is specified
  if (url.indexOf(":", 7) == -1) {
    url += ":8123";
  }

  if (!url.endsWith("/api/hoymiles_cyd_sync")) {
    if (url.endsWith("/"))
      url.remove(url.length() - 1);
    url += "/api/hoymiles_cyd_sync";
  }

  url += "?v=" + String(CURRENT_VERSION);

  Serial.println("--- Sync Attempt ---");
  Serial.print("Target URL: ");
  Serial.println(url);

  HTTPClient http;
  int httpCode = -1;
  String payload = "";

  if (url.startsWith("https")) {
    WiFiClientSecure client_secure;
    client_secure.setInsecure();
    http.begin(client_secure, url);
    if (strlen(ha_token) > 5) {
      http.addHeader("Authorization", "Bearer " + String(ha_token));
    }
    httpCode = http.GET();
    if (httpCode == 200) payload = http.getString();
    http.end();
  } else {
    WiFiClient client;
    http.begin(client, url);
    if (strlen(ha_token) > 5) {
      http.addHeader("Authorization", "Bearer " + String(ha_token));
    }
    httpCode = http.GET();
    if (httpCode == 200) payload = http.getString();
    http.end();
  }

  Serial.print("Result Code: ");
  Serial.println(httpCode);

  if (httpCode == 200) {
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, payload);

    if (!error) {
      solar_power = doc["solar"]["p"];
      solar_yield = doc["solar"]["y"];
      grid_power = doc["grid"]["p"];
      bat_power = doc["bat"]["p"];
      bat_soc = doc["bat"]["soc"];
      status_text = doc["status"].as<String>();
      is_offline = false;
      
      if (doc["update"]) {
        Serial.println("Update trigger from Home Assistant!");
        checkForUpdate();
      }
      Serial.println("Sync: SUCCESS");
    } else {
      Serial.print("JSON Error: ");
      Serial.println(error.c_str());
      is_offline = true;
    }
  } else {
    is_offline = true;
    if (httpCode == 404)
      Serial.println("Error: API Path not found. Check Home Assistant Logs!");
    if (httpCode == 401)
      Serial.println("Error: Unauthorized! Please provide a Token.");
  }
  display_update();
}

void setup() {
  Serial.begin(115200);
  tft.begin();
  tft.setRotation(1); // Landscape

  // WiFi must connect BEFORE mDNS can start
  wifi_connect();

  if (!MDNS.begin("hoymiles-cyd")) {
    Serial.println("Error setting up MDNS responder!");
  } else {
    Serial.println("mDNS responder started: hoymiles-cyd");
    MDNS.addService("hoymiles-cyd", "tcp", 80);
    MDNS.addServiceTxt("hoymiles-cyd", "tcp", "version", CURRENT_VERSION);
  }

  checkForUpdate();
  fetch_ha_data();
}

void loop() {
  if (millis() - last_update > 2000) {
    last_update = millis();
    fetch_ha_data();
  }
  delay(100);
}
