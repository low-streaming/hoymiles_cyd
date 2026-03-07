import {
  LitElement,
  html,
  css,
} from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

class HoymilesCYDPanel extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      activeTab: { type: String },
      config: { type: Object }
    };
  }

  constructor() {
    super();
    this.activeTab = 'dashboard';
    this.config = {
      grid_sensor: '',
      battery_sensor: '',
      min_soc: 20
    };
  }

  updated(changedProps) {
    if (changedProps.has('hass') && this.hass && !this._configLoaded) {
      this._loadConfig();
      this._configLoaded = true;
    }
  }

  async _loadConfig() {
    try {
      const resp = await this.hass.callApi('GET', 'hoymiles_cyd/config');
      this.config = { ...this.config, ...resp };
    } catch (e) {
      console.log("No config found yet");
    }
  }

  async _saveConfig() {
    try {
      await this.hass.callApi('POST', 'hoymiles_cyd/config', this.config);
      // Show success toast
      this.dispatchEvent(new CustomEvent('hass-notification', {
        detail: { message: "Einstellungen gespeichert!", duration: 3000 },
        bubbles: true, composed: true
      }));
    } catch (e) {
      alert("Fehler beim Speichern");
    }
  }

  render() {
    return html`
      <div class="header">
        <h1>🌞 Hoymiles CYD Nulleinspeisung ⚡ <span class="version">v1.2</span></h1>
        <p class="subtitle">Intelligente Einspeisekontrolle & Monitoring</p>
      </div>

      <div class="tabs">
        <div class="tab ${this.activeTab === 'dashboard' ? 'active' : ''}" @click="${() => this.activeTab = 'dashboard'}">Dashboard</div>
        <div class="tab ${this.activeTab === 'settings' ? 'active' : ''}" @click="${() => this.activeTab = 'settings'}">Einstellungen</div>
        <div class="tab ${this.activeTab === 'help' ? 'active' : ''}" @click="${() => this.activeTab = 'help'}">Hilfe</div>
      </div>

      <div class="content">
        ${this.activeTab === 'dashboard' ? this.renderDashboard() :
        this.activeTab === 'settings' ? this.renderSettings() :
          this.renderHelp()}
      </div>

      <div class="footer">
        <a href="https://github.com/low-streaming/hoymiles_cyd" target="_blank">powered by Hoymiles CYD</a>
      </div>
    `;
  }

  renderDashboard() {
    const status = this.hass.states['sensor.zero_export_controller_nulleinspeisung_status']?.state || 'Unbekannt';
    const limit = this.hass.states['sensor.zero_export_controller_nulleinspeisung_leistungslimit']?.state || '0';
    const ac_power = this.hass.states['sensor.hoymiles_cyd_ac_power']?.state || '0';

    return html`
      <div class="stats-grid">
        <div class="card status-card">
          <div class="card-label">Controller Status</div>
          <div class="card-value ${status.toLowerCase()}">${status}</div>
          <div class="card-icon">⚡</div>
        </div>
        <div class="card">
          <div class="card-label">Aktuelle Erzeugung</div>
          <div class="card-value">${ac_power} W</div>
          <div class="card-icon">☀️</div>
        </div>
        <div class="card">
          <div class="card-label">Leistungslimit</div>
          <div class="card-value">${limit}%</div>
          <div class="card-icon">📉</div>
        </div>
      </div>

      <div class="card warning-card">
         <div class="card-label"><ha-icon icon="mdi:information"></ha-icon> Information</div>
         <p>Die Nulleinspeisung regelt den Wechselrichter basierend auf deinem Netzbezug.</p>
         <div class="progress-bar">
            <div class="progress-fill" style="width: ${limit}%"></div>
         </div>
      </div>
    `;
  }

  renderSettings() {
    return html`
      <div class="card">
        <div class="section-header">
           <ha-icon icon="mdi:cog"></ha-icon> Allgemeine Steuerung
        </div>
        
        <div class="settings-row">
          <div class="info">
            <div class="label">Nulleinspeisung Aktivieren</div>
            <div class="desc">Schaltet die automatische Regelung ein oder aus.</div>
          </div>
          <ha-switch 
            .checked="${this.hass.states['switch.zero_export_controller_nulleinspeisung_aktivieren']?.state === 'on'}"
            @change="${() => this._toggleSwitch('switch.zero_export_controller_nulleinspeisung_aktivieren')}"
          ></ha-switch>
        </div>
        
        <div class="settings-row">
          <div class="info">
            <div class="label">Ziel-Netzbezug (Watt)</div>
            <div class="desc">Der gewünschte Wert am Stromzähler (z.B. 10W um Einspeisung zu vermeiden).</div>
          </div>
          <div class="input-group">
            <input type="number" 
              .value="${this.hass.states['number.zero_export_controller_nulleinspeisung_ziel_netzleistung']?.state || 0}"
              @change="${(e) => this._setNumber('number.zero_export_controller_nulleinspeisung_ziel_netzleistung', e.target.value)}"
            >
            <span class="unit">W</span>
          </div>
        </div>
      </div>

      <div class="card entity-card">
        <div class="section-header">
           <ha-icon icon="mdi:transmission-tower"></ha-icon> Stromzähler / Smart Meter
        </div>
        <p class="desc">Wähle den Sensor aus, der deinen aktuellen Netzbezug in Watt liefert.</p>
        
        <ha-entity-picker
          .hass="${this.hass}"
          .value="${this.config.grid_sensor}"
          .includeDomains="${['sensor']}"
          label="Netz-Leistungssensor (Watt)"
          @value-changed="${(e) => this._updateLocalConfig('grid_sensor', e.detail.value)}"
        ></ha-entity-picker>
      </div>

      <div class="card entity-card">
        <div class="section-header">
           <ha-icon icon="mdi:battery-high"></ha-icon> Batterie-Optionen (Optional)
        </div>
        <p class="desc">Wenn ein Hausspeicher vorhanden ist, kann die Entladung hier begrenzt werden.</p>
        
        <ha-entity-picker
          .hass="${this.hass}"
          .value="${this.config.battery_sensor}"
          .includeDomains="${['sensor']}"
          label="Batterie SOC Sensor (%)"
          @value-changed="${(e) => this._updateLocalConfig('battery_sensor', e.detail.value)}"
        ></ha-entity-picker>

        <div class="settings-row" style="margin-top: 20px;">
          <span>Minimum SOC (%)</span>
          <input type="number" class="small-input" 
            .value="${this.config.min_soc}"
            @change="${(e) => this._updateLocalConfig('min_soc', e.target.value)}"
          >
        </div>
      </div>

      <div class="save-bar">
        <button class="save-btn" @click="${this._saveConfig}">
           <ha-icon icon="mdi:content-save"></ha-icon> Einstellungen speichern
        </button>
      </div>
    `;
  }

  renderHelp() {
    return html`
      <div class="help-container">
        <div class="card help-card blue">
          <h3><ha-icon icon="mdi:information-outline"></ha-icon> Was ist die Nulleinspeisung?</h3>
          <p>
            Diese Steuerung liest permanent deinen aktuellen Stromverbrauch vom Smart Meter aus. 
            Wenn du mehr verbrauchst als du erzeugst, erhöht der Hoymiles Inverter seine Leistung. 
            Wenn du Strom ins Netz einspeist, drosselt die App den Inverter automatisch.
          </p>
        </div>

        <div class="card help-card orange">
          <h3><ha-icon icon="mdi:flash-outline"></ha-icon> Schnelleinrichtung</h3>
          <ul>
            <li><strong>1. Sensor wählen:</strong> Wähle unter Einstellungen deinen Stromzähler-Sensor aus.</li>
            <li><strong>2. Zielwert:</strong> Setze den Ziel-Netzbezug (z.B. auf 10 Watt).</li>
            <li><strong>3. Aktivieren:</strong> Schalte den "Aktivieren"-Switch ein.</li>
          </ul>
        </div>

        <div class="card help-card">
          <h3><ha-icon icon="mdi:help-circle-outline"></ha-icon> Häufige Fragen</h3>
          <p><strong>Warum reagiert mein Inverter verzögert?</strong></p>
          <p>Der Hoymiles Inverter benötigt systembedingt ca. 30-60 Sekunden, um ein neues Leistungslimit umzusetzen.</p>
        </div>
      </div>
    `;
  }

  _updateLocalConfig(key, value) {
    this.config = { ...this.config, [key]: value };
  }

  _toggleSwitch(entity) {
    this.hass.callService('switch', 'turn_toggle', { entity_id: entity });
  }

  _setNumber(entity, value) {
    this.hass.callService('number', 'set_value', { entity_id: entity, value: value });
  }

  static get styles() {
    return css`
      :host {
        display: block;
        padding: 20px;
        background-color: #0c0c0e;
        color: #fff;
        min-height: 100vh;
        font-family: 'Roboto', sans-serif;
      }
      .header { text-align: center; margin-bottom: 30px; }
      h1 { margin: 0; color: #fff; font-size: 2em; display: flex; align-items: center; justify-content: center; gap: 10px; }
      .version { font-size: 0.4em; background: #F7931A; padding: 2px 8px; border-radius: 4px; vertical-align: middle; }
      .subtitle { color: #888; margin: 5px 0; font-size: 1.1em; }
      
      .tabs { display: flex; justify-content: center; gap: 15px; margin-bottom: 30px; }
      .tab { padding: 12px 30px; background: rgba(255,255,255,0.05); border-radius: 8px; cursor: pointer; transition: 0.3s; border: 1px solid transparent; }
      .tab:hover { background: rgba(255,255,255,0.1); }
      .tab.active { background: #F7931A; border-color: #F7931A; color: #fff; box-shadow: 0 0 15px rgba(247, 147, 26, 0.4); }
      
      .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 25px; }
      .card { background: rgba(30, 30, 35, 0.8); padding: 25px; border-radius: 12px; border: 1px solid #3a3a40; position: relative; overflow: hidden; margin-bottom: 20px; }
      .section-header { font-size: 1.2em; font-weight: bold; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; color: #F7931A; }
      
      .card-label { color: #888; font-size: 0.95em; margin-bottom: 10px; }
      .card-value { font-size: 2.2em; font-weight: bold; }
      .card-icon { position: absolute; right: 20px; top: 20px; font-size: 2.5em; opacity: 0.15; }
      
      .card-value.running { color: #2ecc71; text-shadow: 0 0 10px rgba(46, 204, 113, 0.3); }
      .card-value.disabled { color: #e74c3c; }
      
      .settings-row { display: flex; justify-content: space-between; align-items: center; padding: 15px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
      .settings-row .info { flex: 1; }
      .settings-row .label { font-weight: bold; margin-bottom: 4px; }
      .settings-row .desc { font-size: 0.85em; color: #888; }
      
      .input-group { display: flex; align-items: center; gap: 10px; }
      input { background: #1a1a1f; border: 1px solid #3a3a40; color: #fff; padding: 10px; border-radius: 6px; width: 100px; text-align: center; font-size: 1.1em; }
      .small-input { width: 60px; }
      
      .entity-card { background: rgba(20, 20, 25, 0.9); }
      ha-entity-picker { --paper-input-container-input-color: #fff; display: block; width: 100%; margin: 15px 0; }
      
      .save-bar { position: sticky; bottom: 20px; display: flex; justify-content: center; z-index: 100; }
      .save-btn { background: #F7931A; color: #fff; border: none; padding: 15px 40px; border-radius: 30px; font-size: 1.1em; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 10px; box-shadow: 0 5px 20px rgba(0,0,0,0.5); transition: 0.3s; }
      .save-btn:hover { background: #ffaa33; transform: translateY(-2px); }
      
      .progress-bar { height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; margin-top: 15px; overflow: hidden; }
      .progress-fill { height: 100%; background: #F7931A; transition: 1s ease-in-out; }
      
      .help-card h3 { margin-top: 0; display: flex; align-items: center; gap: 10px; }
      .help-card.blue { border-left: 4px solid #3498db; }
      .help-card.orange { border-left: 4px solid #F7931A; }
      ul { padding-left: 20px; }
      li { margin-bottom: 10px; color: #ccc; }

      .warning-card { border: 1px solid rgba(247, 147, 26, 0.3); background: linear-gradient(135deg, rgba(30,30,35,0.8), rgba(247, 147, 26, 0.05)); }
    `;
  }
}
customElements.define("hoymiles-cyd-panel", HoymilesCYDPanel);
