import {
  LitElement,
  html,
  css,
} from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

// Custom Entity Picker inherited from Kairo style
class HoymilesEntityPicker extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      label: { type: String },
      value: { type: String },
      open: { type: Boolean },
      search: { type: String }
    };
  }

  constructor() {
    super();
    this.open = false;
    this.search = '';
  }

  get entities() {
    if (!this.hass) return [];
    return Object.keys(this.hass.states)
      .filter(id => id.startsWith('sensor.'))
      .map(id => ({
        id,
        name: this.hass.states[id].attributes.friendly_name || id
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  _handleInput(e) {
    this.search = e.target.value;
    this.open = true;
  }

  _selectItem(id) {
    this.value = id;
    this.open = false;
    this.search = '';
    this.dispatchEvent(new CustomEvent('value-changed', {
      detail: { value: id },
      bubbles: true, composed: true
    }));
  }

  render() {
    const filtered = this.entities.filter(ent =>
      ent.name.toLowerCase().includes(this.search.toLowerCase()) ||
      ent.id.toLowerCase().includes(this.search.toLowerCase())
    ).slice(0, 50);

    const selectedName = this.value ? (this.hass.states[this.value]?.attributes.friendly_name || this.value) : '';

    return html`
      <div class="picker-wrapper">
        <label>${this.label}</label>
        <div class="input-box" @click="${() => this.open = !this.open}">
          <span>${this.value ? selectedName : html`<span class="placeholder">Entität wählen...</span>`}</span>
          <ha-icon icon="${this.open ? 'mdi:chevron-up' : 'mdi:chevron-down'}"></ha-icon>
        </div>
        
        ${this.open ? html`
          <div class="dropdown glass">
            <input type="text" placeholder="Suchen..." .value="${this.search}" @input="${this._handleInput}" @click="${(e) => e.stopPropagation()}">
            <div class="list">
              ${filtered.map(ent => html`
                <div class="item ${this.value === ent.id ? 'selected' : ''}" @click="${() => this._selectItem(ent.id)}">
                  <div class="name">${ent.name}</div>
                  <div class="id">${ent.id}</div>
                </div>
              `)}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  static get styles() {
    return css`
      :host { display: block; margin-bottom: 20px; }
      .picker-wrapper { position: relative; }
      label { display: block; font-size: 0.8em; color: #888; margin-bottom: 8px; font-weight: bold; text-transform: uppercase; }
      .input-box { 
        background: rgba(10, 10, 12, 0.8); 
        border: 1px solid #3a3a40; 
        padding: 12px 16px; 
        border-radius: 8px; 
        cursor: pointer; 
        display: flex; 
        justify-content: space-between; 
        align-items: center;
        transition: 0.3s;
      }
      .input-box:hover { border-color: #F7931A; }
      .placeholder { color: #555; }
      .dropdown { 
        position: absolute; top: 100%; left: 0; right: 0; z-index: 1000; 
        margin-top: 5px; max-height: 300px; display: flex; flex-direction: column;
        border: 1px solid #F7931A; border-radius: 8px; overflow: hidden;
      }
      .glass { background: #1a1a1f; backdrop-filter: blur(20px); box-shadow: 0 10px 40px rgba(0,0,0,0.8); }
      input { 
        background: #000; border: none; border-bottom: 1px solid #333; 
        padding: 12px; color: #fff; width: 100%; box-sizing: border-box; outline: none;
      }
      .list { overflow-y: auto; flex: 1; }
      .item { padding: 10px 15px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.05); }
      .item:hover { background: rgba(247, 147, 26, 0.1); }
      .item.selected { border-left: 3px solid #F7931A; background: rgba(247, 147, 26, 0.2); }
      .name { font-size: 0.9em; font-weight: bold; }
      .id { font-size: 0.7em; color: #666; }
    `;
  }
}
customElements.define("hoymiles-entity-picker", HoymilesEntityPicker);

class HoymilesCYDPanel extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      activeTab: { type: String },
      config: { type: Object },
      _historyData: { type: Array }
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
    this._historyData = [];
    this._configLoaded = false;
  }

  updated(changedProps) {
    if (changedProps.has('hass') && this.hass && !this._configLoaded) {
      this._loadConfig();
      this._configLoaded = true;
      this._fetchHistory();
      setInterval(() => this._fetchHistory(), 60000);
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

  async _fetchHistory() {
    if (!this.config.grid_sensor) return;
    try {
      const end = new Date();
      const start = new Date(end.getTime() - 3600000);
      const result = await this.hass.callApi(
        'GET',
        `history/period/${start.toISOString()}?filter_entity_id=${this.config.grid_sensor}&end_time=${end.toISOString()}`
      );
      if (result && result.length > 0) {
        this._historyData = result[0];
      }
    } catch (e) { console.error(e); }
  }

  async _saveConfig() {
    try {
      await this.hass.callApi('POST', 'hoymiles_cyd/config', this.config);
      this.dispatchEvent(new CustomEvent('hass-notification', {
        detail: { message: "Einstellungen gespeichert!", duration: 3000 },
        bubbles: true, composed: true
      }));
    } catch (e) { alert("Fehler beim Speichern"); }
  }

  render() {
    return html`
      <div class="panel-container">
        <div class="header">
          <div class="logo-area">
            <div class="logo-icon">⚡</div>
            <div class="logo-text">
              <h1>SYSTEM: S_STEUERUNG</h1>
              <span class="version-tag">NULLEINSPEISUNG ACTIVE</span>
            </div>
          </div>
          <div class="time-area">
            ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} | ${new Date().toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}
          </div>
        </div>

        <div class="tabs">
          <div class="tab ${this.activeTab === 'dashboard' ? 'active' : ''}" @click="${() => this.activeTab = 'dashboard'}">DASHBOARD</div>
          <div class="tab ${this.activeTab === 'settings' ? 'active' : ''}" @click="${() => this.activeTab = 'settings'}">EINSTELLUNGEN</div>
          <div class="tab ${this.activeTab === 'help' ? 'active' : ''}" @click="${() => this.activeTab = 'help'}">HILFE</div>
        </div>

        <div class="main-content">
          ${this.activeTab === 'dashboard' ? this.renderDashboard() :
        this.activeTab === 'settings' ? this.renderSettings() :
          this.renderHelp()}
        </div>
      </div>
    `;
  }

  renderDashboard() {
    const grid_power = parseFloat(this.hass.states[this.config.grid_sensor]?.state || 0);
    const solar_power = parseFloat(this.hass.states['sensor.hoymiles_cyd_ac_power']?.state || 0);
    const limit = parseFloat(this.hass.states['sensor.zero_export_controller_nulleinspeisung_leistungslimit']?.state || 0);

    const house_consumption = solar_power + grid_power;
    const gauge_deg = (limit / 100) * 180;

    return html`
      <div class="dashboard-layout">
        <div class="main-card glass">
          <div class="card-title">ENERGY OVERVIEW (ZERO EXPORT)</div>
          
          <div class="energy-visualizer">
            <div class="node-box solar">
              <div class="node-label">Solar Production</div>
              <div class="node-value orange">${(solar_power / 1000).toFixed(1)} kW</div>
              <div class="node-icon"><ha-icon icon="mdi:solar-panel-large"></ha-icon></div>
            </div>

            <div class="node-box house">
              <div class="node-label">House Consumption</div>
              <div class="node-value">${(house_consumption / 1000).toFixed(1)} kW</div>
              <div class="node-icon"><ha-icon icon="mdi:home-lightning-bolt"></ha-icon></div>
            </div>

            <div class="center-stage">
              <div class="gauge-wrap">
                <div class="gauge-track"></div>
                <div class="gauge-fill" style="transform: rotate(${gauge_deg}deg)"></div>
                <div class="gauge-body">
                   <div class="g-label">GRID BALANCE</div>
                   <div class="g-value">${Math.abs(grid_power)} W</div>
                   <div class="g-sub">${grid_power >= 0 ? html`<ha-icon icon="mdi:arrow-down" class="red"></ha-icon> IMPORT` : html`<ha-icon icon="mdi:arrow-up" class="green"></ha-icon> EXPORT`}</div>
                </div>
              </div>
              
              <!-- Flow Particles -->
              <div class="flow-particles">
                <div class="p-line p1"></div>
                <div class="p-line p2"></div>
                <div class="p-line p3"></div>
              </div>
            </div>

            <div class="node-box grid-status">
              <div class="node-icon"><ha-icon icon="mdi:transmission-tower"></ha-icon></div>
            </div>

            <div class="node-box battery-status">
              <div class="node-icon"><ha-icon icon="mdi:battery-high"></ha-icon></div>
            </div>
          </div>

          <div class="graph-box">
             <div class="g-head">LIVE GRID POWER <span class="time-range">Last hour</span></div>
             <div class="canvas glass-dark">
                <svg viewBox="0 0 400 100" preserveAspectRatio="none">
                  <path d="${this._generateGraphPath(true)}" class="area" />
                  <path d="${this._generateGraphPath()}" class="line" />
                </svg>
             </div>
          </div>
        </div>

        <div class="side-panel">
          <div class="stat-tile glass">
            <div class="t-head">INVERTER STATUS</div>
            <div class="t-body">
              <div class="t-icon"><ha-icon icon="mdi:inverter"></ha-icon></div>
              <div class="t-info">
                <div class="row"><span>Status</span> <span class="green">ONLINE ●</span></div>
                <div class="row"><span>Today Yield</span> <span>${this.hass.states['sensor.hoymiles_cyd_today_yield']?.state || 0} kWh</span></div>
              </div>
            </div>
          </div>

          <div class="stat-tile glass">
            <div class="t-head">GRID BALANCE</div>
            <div class="t-body">
              <div class="t-icon orange"><ha-icon icon="mdi:transmission-tower"></ha-icon></div>
              <div class="t-info">
                <div class="row"><span>Import</span> <span>1.2 kWh</span></div>
                <div class="row"><span>Export</span> <span>0.0 kWh</span></div>
              </div>
            </div>
          </div>

          <div class="stat-tile glass">
            <div class="t-head">YIELD TODAY</div>
            <div class="t-body">
              <div class="t-icon orange"><ha-icon icon="mdi:solar-power-variant"></ha-icon></div>
              <div class="t-info">
                <div class="row"><span>Autarky</span> <span class="orange">100%</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _generateGraphPath(fill = false) {
    if (!this._historyData || this._historyData.length < 2) return "";
    const w = 400, h = 100;
    const data = this._historyData.map(d => parseFloat(d.s) || 0);
    const maxV = Math.max(...data, 100);
    const minV = Math.min(...data, -100);
    const range = maxV - minV;
    const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - minV) / range) * h}`);
    let p = `M ${points[0]}`;
    points.forEach(pt => p += ` L ${pt}`);
    if (fill) p += ` L ${w},${h} L 0,${h} Z`;
    return p;
  }

  renderSettings() {
    return html`
      <div class="settings-wrap">
        <div class="card glass">
          <div class="s-header">⚙️ ALLGEMEINE KONFIGURATION</div>
          <div class="settings-row">
            <div class="info">
              <div class="label">Nulleinspeisung Aktivieren</div>
              <div class="desc">Hauptschalter für die Regelung.</div>
            </div>
            <ha-switch .checked="${this.hass.states['switch.zero_export_controller_nulleinspeisung_aktivieren']?.state === 'on'}"
              @change="${() => this._toggleSwitch('switch.zero_export_controller_nulleinspeisung_aktivieren')}"></ha-switch>
          </div>
        </div>

        <div class="card glass">
          <div class="s-header">📡 SENSOREN (EINSTELLUNGEN)</div>
          <hoymiles-entity-picker .hass="${this.hass}" label="Netz-Leistungssensor (Watt)" .value="${this.config.grid_sensor}"
            @value-changed="${(e) => this.config = { ...this.config, grid_sensor: e.detail.value }}"></hoymiles-entity-picker>
          
          <hoymiles-entity-picker .hass="${this.hass}" label="Batterie-Status (Optional)" .value="${this.config.battery_sensor}"
            @value-changed="${(e) => this.config = { ...this.config, battery_sensor: e.detail.value }}"></hoymiles-entity-picker>
        </div>

        <button class="save-mega-btn" @click="${this._saveConfig}">EINSTELLUNGEN ÜBERNEHMEN</button>
      </div>
    `;
  }

  renderHelp() {
    return html`
      <div class="card glass help-card">
        <h3><ha-icon icon="mdi:information"></ha-icon> Information & Anleitung</h3>
        <p>Willkommen beim Hoymiles CYD Panel. Hier konfigurierst du die intelligente Nulleinspeisung.</p>
        <div class="step-box">
           <h4>1. Sensor wählen</h4>
           <p>Wähle deinen Smart Meter Sensor aus, der den aktuellen Netzbezug in Watt liefert.</p>
        </div>
      </div>
    `;
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
        display: block; background: #08080a; color: #e0e0e0; min-height: 100vh;
        font-family: 'Outfit', sans-serif; --accent: #F7931A;
      }
      .panel-container { max-width: 1400px; margin: 0 auto; padding: 20px; }
      .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
      .logo-area { display: flex; align-items: center; gap: 15px; }
      .logo-icon { 
        font-size: 2em; background: var(--accent); width: 45px; height: 45px; 
        display: flex; align-items: center; justify-content: center; border-radius: 10px;
        box-shadow: 0 0 20px rgba(247, 147, 26, 0.4); color: #fff;
      }
      .logo-text h1 { margin: 0; font-size: 1.1em; letter-spacing: 1px; }
      .version-tag { font-size: 0.7em; color: var(--accent); font-weight: bold; }
      .time-area { font-size: 0.8em; color: #666; font-weight: bold; }

      .tabs { display: flex; gap: 10px; margin-bottom: 30px; }
      .tab { 
        padding: 10px 25px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1);
        border-radius: 6px; cursor: pointer; font-size: 0.8em; font-weight: bold; transition: 0.3s;
      }
      .tab.active { background: var(--accent); color: #fff; border-color: var(--accent); box-shadow: 0 4px 15px rgba(247, 147, 26, 0.3); }

      .dashboard-layout { display: grid; grid-template-columns: 1fr 340px; gap: 20px; }
      .glass { background: rgba(25, 25, 30, 0.8); backdrop-filter: blur(15px); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; }

      .main-card { padding: 30px; display: flex; flex-direction: column; min-height: 600px; position: relative; }
      .card-title { font-size: 0.85em; font-weight: bold; color: #888; margin-bottom: 50px; }

      .energy-visualizer { flex: 1; position: relative; height: 350px; width: 100%; }
      .node-box { position: absolute; display: flex; flex-direction: column; align-items: center; z-index: 10; }
      .node-box.solar { top: 0; left: 0; }
      .node-box.house { top: 0; right: 0; }
      .node-box.grid-status { bottom: 0; left: 100px; }
      .node-box.battery-status { bottom: 0; right: 100px; }
      
      .node-label { font-size: 0.75em; color: #777; margin-bottom: 5px; }
      .node-value { font-size: 1.6em; font-weight: bold; }
      .orange { color: var(--accent); }
      .node-icon { 
        width: 50px; height: 50px; background: rgba(255,255,255,0.05); border-radius: 50%;
        display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.1);
        margin-top: 10px;
      }
      .solar .node-icon { border-color: var(--accent); color: var(--accent); }

      .center-stage { 
        position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
        width: 260px; height: 260px; display: flex; align-items: center; justify-content: center;
      }
      .gauge-wrap { position: relative; width: 200px; height: 200px; display: flex; align-items: center; justify-content: center; }
      .gauge-track { position: absolute; width: 100%; height: 100%; border: 10px solid rgba(255,255,255,0.03); border-radius: 50%; }
      .gauge-fill { 
        position: absolute; width: 100%; height: 100%; border: 10px solid transparent;
        border-top: 10px solid var(--accent); border-radius: 50%; filter: drop-shadow(0 0 8px var(--accent));
        transition: 1s ease-in-out;
      }
      .gauge-body { text-align: center; }
      .g-label { font-size: 0.7em; color: #888; font-weight: bold; letter-spacing: 1px; }
      .g-value { font-size: 2.2em; font-weight: bold; margin: 4px 0; }
      .g-sub { font-size: 0.7em; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 4px; }
      .green { color: #2ecc71; }
      .red { color: #e74c3c; }

      .graph-box { margin-top: 50px; }
      .g-head { font-size: 0.8em; font-weight: bold; margin-bottom: 10px; display: flex; justify-content: space-between; }
      .time-range { color: #444; font-size: 0.9em; }
      .canvas { height: 100px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); position: relative; overflow: hidden; background: #000; }
      .line { stroke: var(--accent); stroke-width: 2; fill: none; }
      .area { fill: rgba(247, 100, 26, 0.1); }

      .side-panel { display: flex; flex-direction: column; gap: 15px; }
      .stat-tile { padding: 20px; }
      .t-head { font-size: 0.7em; font-weight: bold; color: #777; margin-bottom: 20px; letter-spacing: 1px; }
      .t-body { display: flex; align-items: center; gap: 15px; }
      .t-icon { width: 50px; height: 50px; background: rgba(255,255,255,0.03); border-radius: 10px; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.1); }
      .t-icon.orange { border-color: rgba(247, 147, 26, 0.3); color: var(--accent); }
      .t-info { flex: 1; }
      .row { display: flex; justify-content: space-between; font-size: 0.85em; margin-bottom: 4px; }
      .row span:last-child { font-weight: bold; color: #fff; }

      .settings-wrap { max-width: 800px; margin: 0 auto; }
      .save-mega-btn { 
        width: 100%; margin-top: 30px; padding: 20px; background: var(--accent); 
        border: none; border-radius: 10px; color: #fff; font-weight: bold; cursor: pointer; transition: 0.3s;
      }
      .save-mega-btn:hover { background: #ffaa33; transform: scale(1.01); }
      
      .s-header { color: var(--accent); font-weight: bold; margin-bottom: 25px; font-size: 0.9em; }
      .settings-row { display: flex; justify-content: space-between; align-items: center; padding: 15px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
      .info .label { font-size: 1.1em; }
      .info .desc { font-size: 0.8em; color: #555; }
    `;
  }
}
customElements.define("hoymiles-cyd-panel", HoymilesCYDPanel);
