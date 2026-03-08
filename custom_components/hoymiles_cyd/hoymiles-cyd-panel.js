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
        <div class="input-box" @click="${(e) => { e.stopPropagation(); this.open = !this.open; }}">
          <span>${this.value ? selectedName.split(' (')[0] : html`<span class="placeholder">Entität suchen...</span>`}</span>
          <ha-icon icon="${this.open ? 'mdi:chevron-up' : 'mdi:chevron-down'}"></ha-icon>
        </div>
        
        ${this.open ? html`
          <div class="dropdown glass-dark" @click="${(e) => e.stopPropagation()}">
            <div class="search-wrap">
              <ha-icon icon="mdi:magnify"></ha-icon>
              <input type="text" placeholder="Suchen..." .value="${this.search}" @input="${this._handleInput}" autofocus>
            </div>
            <div class="list">
              ${filtered.length > 0 ? filtered.map(ent => html`
                <div class="item ${this.value === ent.id ? 'selected' : ''}" @click="${() => this._selectItem(ent.id)}">
                  <div class="name">${ent.name.split(' (')[0]}</div>
                  <div class="id">${ent.id}</div>
                </div>
              `) : html`<div class="empty">Keine Sensoren gefunden</div>`}
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
      label { display: block; font-size: 0.75em; color: #888; margin-bottom: 8px; font-weight: bold; text-transform: uppercase; }
      .input-box { 
        background: rgba(15, 15, 20, 0.9); 
        border: 1px solid rgba(255,255,255,0.1); 
        padding: 12px 18px; 
        border-radius: 10px; 
        cursor: pointer; 
        display: flex; 
        justify-content: space-between; 
        align-items: center;
        transition: 0.3s;
        color: #fff;
      }
      .input-box:hover { border-color: #F7931A; background: rgba(30,30,35,0.9); }
      .placeholder { color: #444; }
      .dropdown { 
        position: absolute; top: 100%; left: 0; right: 0; z-index: 1000; 
        margin-top: 5px; max-height: 300px; display: flex; flex-direction: column;
        border: 1px solid #F7931A; border-radius: 10px; overflow: hidden;
      }
      .glass-dark { background: #0c0c0e; box-shadow: 0 15px 50px rgba(0,0,0,0.9); }
      .search-wrap { display: flex; align-items: center; background: #000; padding: 0 10px; border-bottom: 1px solid #222; }
      input { 
        background: transparent; border: none; 
        padding: 12px; color: #fff; width: 100%; box-sizing: border-box; outline: none;
      }
      .list { overflow-y: auto; flex: 1; }
      .item { padding: 10px 15px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.03); }
      .item:hover { background: rgba(247, 147, 26, 0.1); }
      .item.selected { border-left: 3px solid #F7931A; background: rgba(247, 147, 26, 0.1); }
      .name { font-size: 0.9em; font-weight: bold; }
      .id { font-size: 0.7em; color: #555; font-family: monospace; }
      .empty { padding: 20px; text-align: center; color: #444; }
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
      grid_energy_import_sensor: '',
      grid_energy_export_sensor: '',
      solar_power_sensor: '',
      solar_energy_yield_sensor: '',
      battery_soc_sensor: '',
      battery_power_sensor: '',
      target_grid_watt: 10
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

      this.addEventListener('click', () => {
        const pickers = this.shadowRoot.querySelectorAll('hoymiles-entity-picker');
        pickers.forEach(p => p.open = false);
      });
    }
  }

  async _loadConfig() {
    try {
      const resp = await this.hass.callApi('GET', 'hoymiles_cyd/config');
      this.config = { ...this.config, ...resp };
    } catch (e) { console.log("No config found yet"); }
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
      if (result && result.length > 0) { this._historyData = result[0]; }
    } catch (e) { console.error(e); }
  }

  async _saveConfig() {
    try {
      await this.hass.callApi('POST', 'hoymiles_cyd/config', this.config);
      this.dispatchEvent(new CustomEvent('hass-notification', {
        detail: { message: "Einstellungen erfolgreich gespeichert!", duration: 3000 },
        bubbles: true, composed: true
      }));
    } catch (e) { alert("Speichern fehlgeschlagen"); }
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
    // Current Power (Watts)
    const grid_p = parseFloat(this.hass.states[this.config.grid_sensor]?.state) || 0;
    const solar_p = parseFloat(this.hass.states[this.config.solar_power_sensor || 'sensor.hoymiles_cyd_ac_power']?.state) || 0;
    const batt_p = parseFloat(this.hass.states[this.config.battery_power_sensor]?.state) || 0;

    // Energy (kWh)
    const yield_today = this.hass.states[this.config.solar_energy_yield_sensor || 'sensor.hoymiles_cyd_today_yield']?.state || '0';
    const import_today = this.hass.states[this.config.grid_energy_import_sensor]?.state || '0';
    const export_today = this.hass.states[this.config.grid_energy_export_sensor]?.state || '0';
    const battery_soc = this.hass.states[this.config.battery_soc_sensor]?.state || null;

    const inverter_temp = this.hass.states['sensor.hoymiles_cyd_temperature']?.state || '--';
    const control_limit = this.hass.states['sensor.zero_export_controller_nulleinspeisung_leistungslimit']?.state || '0';

    const house_consumption = Math.max(0, solar_p + grid_p + (batt_p > 0 ? 0 : Math.abs(batt_p)));
    const gauge_deg = (parseFloat(control_limit) / 100) * 180;

    return html`
      <div class="dashboard-layout">
        <div class="main-card glass">
          <div class="card-caption">ENERGY OVERVIEW (ZERO EXPORT)</div>
          
          <div class="visualizer">
            <div class="labels-top">
              <div class="box">
                <span class="lab">Solar Production</span>
                <span class="val orange">${(solar_p / 1000).toFixed(2)} kW</span>
              </div>
              <div class="box right">
                <span class="lab">House Consumption</span>
                <span class="val">${(house_consumption / 1000).toFixed(2)} kW</span>
              </div>
            </div>

            <div class="engine">
              <svg class="engine-svg" viewBox="0 0 600 400">
                <path d="M 120 100 Q 300 100 300 200" class="pth p-solar" />
                <path d="M 480 100 Q 300 100 300 200" class="pth p-house" />
                <path d="M 120 300 Q 300 300 300 200" class="pth p-grid" />
                <path d="M 480 300 Q 300 300 300 200" class="pth p-batt" />
                
                ${solar_p > 10 ? html`<circle r="4" fill="#F7931A"><animateMotion dur="2s" repeatCount="indefinite" path="M 120 100 Q 300 100 300 200" /></circle>` : ''}
                ${house_consumption > 10 ? html`<circle r="4" fill="#fff"><animateMotion dur="2s" repeatCount="indefinite" path="M 300 200 Q 300 100 480 100" /></circle>` : ''}
                ${grid_p > 10 ? html`<circle r="4" fill="#888"><animateMotion dur="3s" repeatCount="indefinite" path="M 120 300 Q 300 300 300 200" /></circle>` : ''}
              </svg>

              <div class="node n-solar" style="top: 75px; left: 95px;"><ha-icon icon="mdi:solar-panel-large"></ha-icon></div>
              <div class="node n-house" style="top: 75px; right: 95px;"><ha-icon icon="mdi:home-lightning-bolt"></ha-icon></div>
              <div class="node n-grid" style="bottom: 75px; left: 95px;"><ha-icon icon="mdi:transmission-tower"></ha-icon></div>
              <div class="node n-batt" style="bottom: 75px; right: 95px;">
                <ha-icon icon="mdi:battery-high"></ha-icon>
                ${battery_soc ? html`<div class="soc-tag">${battery_soc}%</div>` : ''}
              </div>

              <div class="gauge-center">
                <div class="g-ring"></div>
                <div class="g-arc" style="transform: rotate(${gauge_deg}deg)"></div>
                <div class="g-inner">
                   <div class="g-cap">GRID BALANCE</div>
                   <div class="g-main">${Math.abs(grid_p)} W</div>
                   <div class="g-stat ${grid_p >= 0 ? 'red' : 'green'}">
                      <ha-icon icon="${grid_p >= 0 ? 'mdi:chevron-down' : 'mdi:chevron-up'}"></ha-icon>
                      ${grid_p >= 0 ? 'IMPORT' : 'EXPORT'}
                   </div>
                </div>
              </div>
            </div>
          </div>

          <div class="graph-area">
             <div class="graph-info">LIVE GRID POWER <span class="range">Last hour</span></div>
             <div class="canvas glass-dark">
                <svg viewBox="0 0 500 100" preserveAspectRatio="none">
                  <path d="${this._generateGraphPath(true)}" class="area-f" />
                  <path d="${this._generateGraphPath()}" class="line-f" />
                </svg>
             </div>
          </div>
        </div>

        <div class="sidebar">
          <div class="side-card glass">
            <div class="s-cap">INVERTER STATUS</div>
            <div class="s-flex">
              <div class="s-icon"><ha-icon icon="mdi:inverter"></ha-icon></div>
              <div class="s-vals">
                <div class="s-row"><span>Status</span> <span class="green">ONLINE ●</span></div>
                <div class="s-row"><span>Heute Ertrag</span> <span>${yield_today} kWh</span></div>
                <div class="s-row"><span>Temperatur</span> <span>${inverter_temp}°C</span></div>
              </div>
            </div>
          </div>

          <div class="side-card glass">
            <div class="s-cap">ENERGY FLOWS</div>
            <div class="s-flex">
              <div class="s-icon orange"><ha-icon icon="mdi:transmission-tower"></ha-icon></div>
              <div class="s-vals">
                <div class="s-row"><span>Heute Import</span> <span>${import_today} kWh</span></div>
                <div class="s-row"><span>Heute Export</span> <span>${export_today} kWh</span></div>
              </div>
            </div>
          </div>

          <div class="side-card glass">
            <div class="s-cap">CONTROLLER</div>
            <div class="s-flex">
              <div class="s-icon orange"><ha-icon icon="mdi:tune"></ha-icon></div>
              <div class="s-vals">
                <div class="s-row"><span>Leistungslimit</span> <span>${control_limit}%</span></div>
                <div class="s-row"><span>Autarkie</span> <span class="orange">-- %</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _generateGraphPath(fill = false) {
    if (!this._historyData || this._historyData.length < 2) return "";
    const w = 500, h = 100;
    const data = this._historyData.map(d => parseFloat(d.s) || 0);
    const maxV = Math.max(...data, 100);
    const minV = Math.min(...data, -100);
    const range = Math.max(1, maxV - minV);
    const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - minV) / range) * h}`);
    let p = `M ${pts[0]}`; pts.forEach(pt => p += ` L ${pt}`);
    if (fill) p += ` L ${w},${h} L 0,${h} Z`;
    return p;
  }

  renderSettings() {
    return html`
      <div class="settings-page">
        <div class="config-section glass">
           <div class="section-title">⚙️ SYSTEM KONFIGURATION</div>
           
           <div class="cfg-row">
              <div class="cfg-info">
                 <div class="cfg-label">Automatisierung Aktivieren</div>
                 <div class="cfg-desc">Aktiviert oder deaktiviert die Nulleinspeisung.</div>
              </div>
              <ha-switch .checked="${this.hass.states['switch.zero_export_controller_nulleinspeisung_aktivieren']?.state === 'on'}"
                @change="${() => this._toggleSwitch('switch.zero_export_controller_nulleinspeisung_aktivieren')}"></ha-switch>
           </div>

           <div class="cfg-row">
              <div class="cfg-info">
                 <div class="cfg-label">Ziel-Netzbezug (Watt)</div>
                 <div class="cfg-desc">Der Wert am Zähler, der stabil gehalten werden soll.</div>
              </div>
              <input type="number" class="cfg-num" .value="${this.config.target_grid_watt || 0}"
                @change="${(e) => this.config = { ...this.config, target_grid_watt: e.target.value }}">
           </div>
        </div>

        <div class="config-section glass">
           <div class="section-title">📡 SENSOR ZUORDNUNG</div>
           <p class="section-lead">Verknüpfe hier deine Home Assistant Sensoren für das Dashboard.</p>
           
           <div class="picker-grid">
              <hoymiles-entity-picker .hass="${this.hass}" label="Solar Produktion (Watt)" .value="${this.config.solar_power_sensor}"
                @value-changed="${(e) => this.config = { ...this.config, solar_power_sensor: e.detail.value }}"></hoymiles-entity-picker>

              <hoymiles-entity-picker .hass="${this.hass}" label="Solar Heute Ertrag (kWh)" .value="${this.config.solar_energy_yield_sensor}"
                @value-changed="${(e) => this.config = { ...this.config, solar_energy_yield_sensor: e.detail.value }}"></hoymiles-entity-picker>

              <hoymiles-entity-picker .hass="${this.hass}" label="Stromzähler Power (Watt)" .value="${this.config.grid_sensor}"
                @value-changed="${(e) => this.config = { ...this.config, grid_sensor: e.detail.value }}"></hoymiles-entity-picker>

              <hoymiles-entity-picker .hass="${this.hass}" label="Netz Import Heute (kWh)" .value="${this.config.grid_energy_import_sensor}"
                @value-changed="${(e) => this.config = { ...this.config, grid_energy_import_sensor: e.detail.value }}"></hoymiles-entity-picker>

              <hoymiles-entity-picker .hass="${this.hass}" label="Netz Export Heute (kWh)" .value="${this.config.grid_energy_export_sensor}"
                @value-changed="${(e) => this.config = { ...this.config, grid_energy_export_sensor: e.detail.value }}"></hoymiles-entity-picker>

              <hoymiles-entity-picker .hass="${this.hass}" label="Batterie Power (Watt)" .value="${this.config.battery_power_sensor}"
                @value-changed="${(e) => this.config = { ...this.config, battery_power_sensor: e.detail.value }}"></hoymiles-entity-picker>

              <hoymiles-entity-picker .hass="${this.hass}" label="Batterie SOC (%)" .value="${this.config.battery_soc_sensor}"
                @value-changed="${(e) => this.config = { ...this.config, battery_soc_sensor: e.detail.value }}"></hoymiles-entity-picker>
           </div>
        </div>

        <button class="mega-save-btn" @click="${this._saveConfig}">EINSTELLUNGEN ÜBERNEHMEN</button>
      </div>
    `;
  }

  renderHelp() {
    return html`<div class="help-page card glass"><h3>HILFE</h3><p>Konfigurieren Sie alle Sensoren unter 'Einstellungen', um das Dashboard zu füllen.</p></div>`;
  }

  _toggleSwitch(entity) { this.hass.callService('switch', 'turn_toggle', { entity_id: entity }); }
  _setNumber(entity, value) { this.hass.callService('number', 'set_value', { entity_id: entity, value: value }); }

  static get styles() {
    return css`
      :host { display: block; background: #08080a; color: #e0e0e0; min-height: 100vh; font-family: 'Outfit', sans-serif; --accent: #F7931A; }
      .panel-container { max-width: 1440px; margin: 0 auto; padding: 20px; }
      .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
      .logo-area { display: flex; align-items: center; gap: 15px; }
      .logo-icon { font-size: 2em; background: var(--accent); width: 45px; height: 45px; display: flex; align-items: center; justify-content: center; border-radius: 12px; box-shadow: 0 0 20px rgba(247, 147, 26, 0.4); color: #fff; }
      .logo-text h1 { margin: 0; font-size: 1.25em; letter-spacing: 1px; color: #fff; }
      .version-tag { font-size: 0.7em; color: var(--accent); font-weight: bold; }
      .time-area { font-size: 0.85em; color: #666; font-weight: 500; }

      .tabs { display: flex; gap: 10px; margin-bottom: 35px; }
      .tab { padding: 12px 28px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; cursor: pointer; font-size: 0.8em; font-weight: bold; transition: 0.3s; color: #888; }
      .tab.active { background: var(--accent); color: #fff; border-color: var(--accent); box-shadow: 0 5px 20px rgba(247, 147, 26, 0.3); }

      .dashboard-layout { display: grid; grid-template-columns: 1fr 340px; gap: 25px; }
      .glass { background: rgba(20, 20, 25, 0.82); backdrop-filter: blur(25px); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.6); }

      .main-card { padding: 40px; min-height: 700px; display: flex; flex-direction: column; }
      .card-caption { font-size: 0.8em; font-weight: bold; color: #888; margin-bottom: 50px; letter-spacing: 1.5px; }

      .visualizer { flex: 1; position: relative; }
      .labels-top { display: flex; justify-content: space-between; position: relative; z-index: 50; }
      .labels-top .box { display: flex; flex-direction: column; }
      .lab { font-size: 0.8em; color: #777; margin-bottom: 5px; }
      .val { font-size: 2.2em; font-weight: bold; }
      .orange { color: var(--accent); text-shadow: 0 0 15px rgba(247, 147, 26, 0.5); }

      .engine { position: relative; width: 600px; height: 400px; margin: 0 auto; }
      .engine-svg { position: absolute; width: 100%; height: 100%; }
      .pth { fill: none; stroke: rgba(255,255,255,0.05); stroke-width: 3; }
      .node { position: absolute; width: 55px; height: 55px; border-radius: 50%; background: #111; border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; z-index: 10; font-size: 1.3em; }
      .n-solar { color: var(--accent); border-color: var(--accent); }
      .soc-tag { position: absolute; top: -10px; right: -10px; background: var(--accent); color: #000; font-size: 0.7em; font-weight: bold; padding: 2px 6px; border-radius: 10px; }

      .gauge-center { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; justify-content: center; width: 250px; height: 250px; }
      .g-ring { position: absolute; width: 100%; height: 100%; border: 12px solid rgba(255,255,255,0.03); border-radius: 50%; }
      .g-arc { position: absolute; width: 100%; height: 100%; border: 12px solid transparent; border-top-color: var(--accent); border-radius: 50%; filter: drop-shadow(0 0 10px var(--accent)); transition: 1s ease; }
      .g-cap { font-size: 0.7em; color: #777; font-weight: bold; margin-bottom: 5px; }
      .g-main { font-size: 2.8em; font-weight: bold; color: #fff; }
      .g-stat { font-size: 0.85em; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 5px; }

      .graph-area { margin-top: 40px; }
      .graph-info { font-size: 0.85em; font-weight: bold; color: #555; margin-bottom: 12px; }
      .canvas { height: 100px; border-radius: 15px; overflow: hidden; background: #000; position: relative; }
      .line-f { stroke: var(--accent); stroke-width: 2.5; fill: none; }
      .area-f { fill: linear-gradient(to bottom, rgba(247, 147, 26, 0.2), transparent); }

      .sidebar { display: flex; flex-direction: column; gap: 20px; }
      .side-card { padding: 25px; }
      .s-cap { font-size: 0.75em; font-weight: bold; color: #666; margin-bottom: 20px; }
      .s-flex { display: flex; align-items: center; gap: 20px; }
      .s-icon { width: 55px; height: 55px; background: rgba(255,255,255,0.03); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.4em; border: 1px solid rgba(255,255,255,0.08); }
      .s-icon.orange { color: var(--accent); border-color: rgba(247, 147, 26, 0.2); }
      .s-vals { flex: 1; }
      .s-row { display: flex; justify-content: space-between; font-size: 0.85em; margin-bottom: 6px; }

      .settings-page { max-width: 900px; margin: 0 auto; }
      .config-section { padding: 35px; margin-bottom: 30px; }
      .section-title { color: var(--accent); font-weight: bold; margin-bottom: 30px; }
      .cfg-row { display: flex; justify-content: space-between; align-items: center; padding: 20px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
      .cfg-label { font-size: 1.1em; font-weight: 500; }
      .cfg-desc { font-size: 0.85em; color: #555; }
      .cfg-num { background: #000; border: 1px solid #333; color: #fff; padding: 12px; border-radius: 8px; width: 100px; text-align: center; }
      .picker-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 20px; }
      
      .mega-save-btn { width: 100%; padding: 22px; background: var(--accent); border: none; border-radius: 15px; color: #fff; font-weight: bold; cursor: pointer; transition: 0.3s; font-size: 1.2em; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
      .mega-save-btn:hover { background: #ffaa33; transform: scale(1.02); }

      .green { color: #2ecc71 !important; }
      .red { color: #e74c3c !important; }
    `;
  }
}
customElements.define("hoymiles-cyd-panel", HoymilesCYDPanel);
