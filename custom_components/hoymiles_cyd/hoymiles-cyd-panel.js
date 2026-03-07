import {
  LitElement,
  html,
  css,
} from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

class HoymilesCYDPanel extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      activeTab: { type: String }
    };
  }

  constructor() {
    super();
    this.activeTab = 'dashboard';
  }

  render() {
    return html`
      <div class="header">
        <h1>🌞 Hoymiles CYD Nulleinspeisung ⚡ <span class="version">v1.1</span></h1>
        <p class="subtitle">Intelligente Einspeisekontrolle & Monitoring</p>
      </div>

      <div class="tabs">
        <div class="tab ${this.activeTab === 'dashboard' ? 'active' : ''}" @click="${() => this.activeTab = 'dashboard'}">Dashboard</div>
        <div class="tab ${this.activeTab === 'settings' ? 'active' : ''}" @click="${() => this.activeTab = 'settings'}">Einstellungen</div>
      </div>

      <div class="content">
        ${this.activeTab === 'dashboard' ? this.renderDashboard() : this.renderSettings()}
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

      <div class="card graph-card">
         <div class="card-label">System Live-Daten</div>
         <p style="color: #888;">Hier werden zukünftig detaillierte Energieflüsse visualisiert.</p>
      </div>
    `;
  }

  renderSettings() {
    return html`
      <div class="card">
        <h2>Steuerung</h2>
        <div class="settings-row">
          <span>Automatische Nulleinspeisung</span>
          <ha-switch 
            .checked="${this.hass.states['switch.zero_export_controller_nulleinspeisung_aktivieren']?.state === 'on'}"
            @change="${() => this._toggleSwitch('switch.zero_export_controller_nulleinspeisung_aktivieren')}"
          ></ha-switch>
        </div>
        
        <div class="settings-row">
          <span>Ziel-Netzbezug (Watt)</span>
          <div class="input-group">
            <input type="number" 
              .value="${this.hass.states['number.zero_export_controller_nulleinspeisung_ziel_netzleistung']?.state || 0}"
              @change="${(e) => this._setNumber('number.zero_export_controller_nulleinspeisung_ziel_netzleistung', e.target.value)}"
            >
            <span class="unit">W</span>
          </div>
        </div>
      </div>
    `;
  }

  _toggleSwitch(entity) {
    this.hass.callService('switch', 'toggle', { entity_id: entity });
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
      h1 { margin: 0; color: #fff; font-size: 2em; }
      .version { font-size: 0.4em; background: #F7931A; padding: 2px 6px; border-radius: 4px; vertical-align: middle; }
      .subtitle { color: #888; margin: 5px 0; }
      
      .tabs { display: flex; justify-content: center; gap: 10px; margin-bottom: 25px; }
      .tab { padding: 10px 25px; background: rgba(255,255,255,0.05); border-radius: 20px; cursor: pointer; transition: 0.3s; }
      .tab.active { background: #F7931A; color: #fff; }
      
      .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 25px; }
      .card { background: rgba(30, 30, 35, 0.8); padding: 25px; border-radius: 12px; border: 1px solid #3a3a40; position: relative; overflow: hidden; }
      .card-label { color: #888; font-size: 0.9em; margin-bottom: 10px; }
      .card-value { font-size: 1.8em; font-weight: bold; }
      .card-icon { position: absolute; right: 20px; top: 20px; font-size: 2em; opacity: 0.2; }
      
      .card-value.running { color: #2ecc71; }
      .card-value.disabled { color: #e74c3c; }
      
      .settings-row { display: flex; justify-content: space-between; align-items: center; padding: 15px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
      .input-group { display: flex; align-items: center; gap: 10px; }
      input { background: #1a1a1f; border: 1px solid #3a3a40; color: #fff; padding: 8px; border-radius: 4px; width: 80px; text-align: center; }
      
      .footer { text-align: center; margin-top: 50px; opacity: 0.5; }
      a { color: #F7931A; text-decoration: none; }
    `;
  }
}
customElements.define("hoymiles-cyd-panel", HoymilesCYDPanel);
