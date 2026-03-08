#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <TFT_eSPI.h>
#include <WiFi.h>
#include <WiFiManager.h>

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
      preferences.getString("ha_host", "http://192.168.2.69:8123");
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

void draw_card(int x, int y, int w, int h, const char *label, float val,
               const char *unit, uint16_t color) {
  tft.fillRoundRect(x, y, w, h, 8, COLOR_CARD);
  tft.drawRoundRect(x, y, w, h, 8, tft.color565(50, 50, 55));

  tft.setTextColor(COLOR_DIM);
  tft.setTextSize(1);
  tft.setCursor(x + 8, y + 8);
  tft.print(label);

  tft.setTextColor(TFT_WHITE);
  tft.setTextSize(3);
  tft.setCursor(x + 10, y + 25);
  // Simple check for large values
  if (val < 10 && val > -10)
    tft.print(val, 1);
  else
    tft.print((int)val);

  tft.setTextSize(1);
  tft.setTextColor(color);
  tft.print(" ");
  tft.print(unit);
}

void display_update() {
  tft.fillScreen(COLOR_BG);

  // Header
  tft.fillRect(0, 0, 320, 35, tft.color565(20, 20, 25));
  tft.setTextColor(COLOR_ACCENT);
  tft.setTextSize(2);
  tft.setCursor(10, 10);
  tft.print("Solar Zentrale");

  tft.setTextSize(1);
  tft.setCursor(240, 12);
  if (is_offline) {
    tft.setTextColor(TFT_RED);
    tft.print("OFFLINE");
  } else {
    tft.setTextColor(TFT_GREEN);
    tft.print("AKTIV");
  }

  // Visualizer Center Ring (Power Core Style)
  int cx = 160, cy = 135, r = 55;
  tft.drawCircle(cx, cy, r, tft.color565(40, 40, 50));
  tft.drawCircle(cx, cy, r + 1, tft.color565(30, 30, 40));

  // Grid Pulse Indicator
  uint16_t grid_color =
      (grid_power > 0) ? COLOR_BAT : COLOR_GRID; // Import vs Export
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

  // Flow Lines (Simple)
  // Solar to center
  tft.drawLine(65, 110, cx - cx / 4, cy - cy / 4, COLOR_SOLAR);

  // Cards
  draw_card(10, 45, 110, 65, "SOLAR", solar_power, "W", COLOR_SOLAR);
  draw_card(10, 115, 110, 65, "ERTRAG", solar_yield, "kWh", COLOR_ACCENT);

  draw_card(200, 45, 110, 65, "AKKU", bat_soc, "%", COLOR_BAT);
  draw_card(200, 115, 110, 65, "HAUS", (solar_power + grid_power - bat_power),
            "W", COLOR_ACCENT);

  // Footer / Status
  tft.setTextColor(COLOR_DIM);
  tft.setCursor(10, 220);
  tft.print("REGELUNG: ");
  tft.setTextColor(COLOR_ACCENT);
  tft.print(status_text);
}

void fetch_ha_data() {
  if (WiFi.status() != WL_CONNECTED)
    return;

  WiFiClient client;
  HTTPClient http;

  String url = String(ha_host);
  if (url.length() < 5)
    return;

  // Fix URL Scheme
  if (!url.startsWith("http")) {
    url = "http://" + url;
  }

  // Only append :8123 if NO port is specified (checks for second colon after
  // http://)
  if (url.indexOf(":", 7) == -1) {
    url += ":8123";
  }

  // Ensure we use the NEW flat API path
  if (!url.endsWith("/api/hoymiles_cyd_sync")) {
    if (url.endsWith("/"))
      url.remove(url.length() - 1);
    url += "/api/hoymiles_cyd_sync";
  }

  Serial.println("--- Sync Attempt ---");
  Serial.print("Target URL: ");
  Serial.println(url);
  if (strlen(ha_token) > 10) {
    Serial.println("Auth: Token provided");
  } else {
    Serial.println("Auth: No token (trying Public Access)");
  }

  http.begin(client, url);
  if (strlen(ha_token) > 5) {
    http.addHeader("Authorization", "Bearer " + String(ha_token));
  }

  int httpCode = http.GET();
  Serial.print("Result Code: ");
  Serial.println(httpCode);

  if (httpCode == 200) {
    String payload = http.getString();
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
  http.end();
  display_update();
}

void setup() {
  Serial.begin(115200);
  tft.begin();
  tft.setRotation(1); // Landscape

  wifi_connect();
  fetch_ha_data();
}

void loop() {
  if (millis() - last_update > 5000) {
    last_update = millis();
    fetch_ha_data();
  }
  delay(100);
}
