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
          <span>${this.value ? selectedName.split(' (')[0] : html`<span class="placeholder">Entität wählen...</span>`}</span>
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
      :host { display: block; margin-bottom: 25px; }
      .picker-wrapper { position: relative; }
      label { display: block; font-size: 0.75em; color: #888; margin-bottom: 8px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
      .input-box { 
        background: rgba(15, 15, 20, 0.9); 
        border: 1px solid rgba(255,255,255,0.1); 
        padding: 14px 18px; 
        border-radius: 12px; 
        cursor: pointer; 
        display: flex; 
        justify-content: space-between; 
        align-items: center;
        transition: 0.3s;
        color: #fff;
        font-weight: 500;
      }
      .input-box:hover { border-color: var(--accent, #F7931A); background: rgba(30,30,35,0.9); }
      .placeholder { color: #555; }
      .dropdown { 
        position: absolute; top: 100%; left: 0; right: 0; z-index: 1000; 
        margin-top: 8px; max-height: 350px; display: flex; flex-direction: column;
        border: 1px solid var(--accent, #F7931A); border-radius: 12px; overflow: hidden;
      }
      .glass-dark { background: #0c0c0e; backdrop-filter: blur(25px); box-shadow: 0 15px 50px rgba(0,0,0,0.9); }
      .search-wrap { display: flex; align-items: center; background: #000; padding: 0 15px; border-bottom: 1px solid #222; }
      .search-wrap ha-icon { color: #666; font-size: 1.2em; }
      input { 
        background: transparent; border: none; 
        padding: 15px; color: #fff; width: 100%; box-sizing: border-box; outline: none;
        font-family: inherit; font-size: 1em;
      }
      .list { overflow-y: auto; flex: 1; }
      .item { padding: 12px 18px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.03); transition: 0.2s; }
      .item:hover { background: rgba(247, 147, 26, 0.1); }
      .item.selected { border-left: 4px solid var(--accent, #F7931A); background: rgba(247, 147, 26, 0.15); }
      .name { font-size: 0.95em; font-weight: bold; color: #eee; }
      .id { font-size: 0.75em; color: #666; font-family: monospace; }
      .empty { padding: 25px; text-align: center; color: #555; font-style: italic; }
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
      _historyData: { type: Array },
      _solarEntity: { type: String }
    };
  }

  constructor() {
    super();
    this.activeTab = 'dashboard';
    this.config = {
      grid_sensor: '',
      battery_sensor: '',
      solar_sensor: '',
      min_soc: 20
    };
    this._historyData = [];
    this._configLoaded = false;
    this._solarEntity = 'sensor.hoymiles_cyd_ac_power';
  }

  updated(changedProps) {
    if (changedProps.has('hass') && this.hass && !this._configLoaded) {
      this._loadConfig();
      this._configLoaded = true;
      this._fetchHistory();
      setInterval(() => this._fetchHistory(), 60000);

      // Auto-click document to close pickers
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
      if (this.config.solar_sensor) {
        this._solarEntity = this.config.solar_sensor;
      }
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
      this._solarEntity = this.config.solar_sensor || this._solarEntity;
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
    const grid_power = parseFloat(this.hass.states[this.config.grid_sensor]?.state) || 0;
    const solar_power = parseFloat(this.hass.states[this._solarEntity]?.state) || 0;
    const battery_soc = this.config.battery_sensor ? (parseFloat(this.hass.states[this.config.battery_sensor]?.state) || 0) : null;
    const limit = parseFloat(this.hass.states['sensor.zero_export_controller_nulleinspeisung_leistungslimit']?.state) || 0;
    const yielding_today = this.hass.states['sensor.hoymiles_cyd_today_yield']?.state || '0';
    const inverter_temp = this.hass.states['sensor.hoymiles_cyd_temperature']?.state || '0';

    const house_consumption = Math.max(0, solar_power + grid_power);
    const gauge_deg = (limit / 100) * 180;

    return html`
      <div class="dashboard-layout">
        <div class="main-card glass">
          <div class="card-title">ENERGY OVERVIEW (ZERO EXPORT)</div>
          
          <div class="energy-visualizer">
            <!-- Labels -->
            <div class="top-labels">
              <div class="label-box">
                <div class="label">Solar Production</div>
                <div class="value orange">${(solar_power / 1000).toFixed(2)} kW</div>
              </div>
              <div class="label-box house-label">
                <div class="label">House Consumption</div>
                <div class="value">${(house_consumption / 1000).toFixed(2)} kW</div>
              </div>
            </div>

            <div class="visual-engine">
              <svg class="flow-svg" viewBox="0 0 600 400">
                <defs>
                   <filter id="glow">
                      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                      <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
                   </filter>
                </defs>
                <!-- Connection Paths -->
                <path d="M 100 80 Q 300 80 300 200" class="flow-path solar-flow" />
                <path d="M 500 80 Q 300 80 300 200" class="flow-path house-flow" />
                <path d="M 100 320 Q 300 320 300 200" class="flow-path grid-flow" />
                <path d="M 500 320 Q 300 320 300 200" class="flow-path battery-flow" />

                <!-- Flowing Particles (Dots) -->
                ${solar_power > 10 ? html`<circle r="4" fill="#F7931A" filter="url(#glow)"><animateMotion dur="2s" repeatCount="indefinite" path="M 100 80 Q 300 80 300 200" /></circle>` : ''}
                ${house_consumption > 10 ? html`<circle r="4" fill="#fff" filter="url(#glow)"><animateMotion dur="2.5s" repeatCount="indefinite" path="M 300 200 Q 300 80 500 80" /></circle>` : ''}
                ${grid_power > 10 ? html`<circle r="4" fill="#666" filter="url(#glow)"><animateMotion dur="3s" repeatCount="indefinite" path="M 100 320 Q 300 320 300 200" /></circle>` : ''}
                ${grid_power < -10 ? html`<circle r="4" fill="#2ecc71" filter="url(#glow)"><animateMotion dur="3s" repeatCount="indefinite" path="M 300 200 Q 300 320 100 320" /></circle>` : ''}
              </svg>

              <!-- Node Nodes -->
              <div class="node solar-node" style="top: 55px; left: 75px;">
                <ha-icon icon="mdi:solar-panel-large"></ha-icon>
              </div>
              <div class="node house-node" style="top: 55px; right: 75px;">
                <ha-icon icon="mdi:home-lightning-bolt"></ha-icon>
              </div>
              <div class="node grid-node" style="bottom: 55px; left: 75px;">
                <ha-icon icon="mdi:transmission-tower"></ha-icon>
              </div>
              <div class="node battery-node" style="bottom: 55px; right: 75px;">
                <ha-icon icon="mdi:battery-high"></ha-icon>
                ${battery_soc !== null ? html`<div class="soc-bubble">${battery_soc.toFixed(0)}%</div>` : ''}
              </div>

              <!-- Main Gauge -->
              <div class="center-gauge">
                <div class="gauge-ring"></div>
                <div class="gauge-arc" style="transform: rotate(${gauge_deg}deg)"></div>
                <div class="gauge-content">
                  <div class="gl">GRID BALANCE</div>
                  <div class="gv">${Math.abs(grid_power)} W</div>
                  <div class="gs ${grid_power >= 0 ? 'red' : 'green'}">
                    <ha-icon icon="${grid_power >= 0 ? 'mdi:arrow-bottom-left' : 'mdi:arrow-top-right'}"></ha-icon>
                    ${grid_power >= 0 ? 'IMPORT' : 'EXPORT'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="graph-section">
             <div class="graph-header">LIVE GRID POWER <span class="range">Last hour</span></div>
             <div class="graph-canvas glass-dark">
                <svg viewBox="0 0 500 100" preserveAspectRatio="none">
                  <path d="${this._generateGraphPath(true)}" class="area" />
                  <path d="${this._generateGraphPath()}" class="line" />
                </svg>
             </div>
          </div>
        </div>

        <div class="stats-area">
          <div class="side-tile glass">
            <div class="t-cap">INVERTER STATUS</div>
            <div class="t-main">
              <div class="t-ico"><ha-icon icon="mdi:inverter"></ha-icon></div>
              <div class="t-rows">
                <div class="t-row"><span>Status</span> <span class="green">ONLINE ●</span></div>
                <div class="t-row"><span>Production</span> <span>${solar_power} W</span></div>
                <div class="t-row"><span>Temp</span> <span>${inverter_temp}°C</span></div>
              </div>
            </div>
          </div>

          <div class="side-tile glass">
            <div class="t-cap">ENERGY FLOWS</div>
            <div class="t-main">
              <div class="t-ico orange"><ha-icon icon="mdi:transmission-tower"></ha-icon></div>
              <div class="t-rows">
                <div class="t-row"><span>Yield Today</span> <span>${yielding_today} kWh</span></div>
                <div class="t-row"><span>Grid Import</span> <span>-- kWh</span></div>
              </div>
            </div>
          </div>

          <div class="side-tile glass">
            <div class="t-cap">NULLEINSPEISUNG</div>
            <div class="t-main">
              <div class="t-ico orange"><ha-icon icon="mdi:tune"></ha-icon></div>
              <div class="t-rows">
                <div class="t-row"><span>Leistungslimit</span> <span>${limit}%</span></div>
                <div class="t-row"><span>Autarkie</span> <span class="orange">100%</span></div>
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
    const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - minV) / range) * h}`);
    let p = `M ${points[0]}`;
    points.forEach(pt => p += ` L ${pt}`);
    if (fill) p += ` L ${w},${h} L 0,${h} Z`;
    return p;
  }

  renderSettings() {
    return html`
      <div class="settings-wrap">
        <div class="config-card glass">
          <div class="c-head">⚙️ SYSTEM KONFIGURATION</div>
          
          <div class="s-row">
            <div class="s-info">
              <div class="s-label">Regelung Aktivieren</div>
              <div class="s-desc">Aktiviert die Nulleinspeisung.</div>
            </div>
            <ha-switch .checked="${this.hass.states['switch.zero_export_controller_nulleinspeisung_aktivieren']?.state === 'on'}"
              @change="${() => this._toggleSwitch('switch.zero_export_controller_nulleinspeisung_aktivieren')}"></ha-switch>
          </div>

          <div class="s-row">
            <div class="s-info">
              <div class="s-label">Ziel-Netzleistung (Watt)</div>
              <div class="s-desc">Gewünschter Wert am Stromzähler.</div>
            </div>
            <input type="number" class="num-input" .value="${this.hass.states['number.zero_export_controller_nulleinspeisung_ziel_netzleistung']?.state || 0}"
                 @change="${(e) => this._setNumber('number.zero_export_controller_nulleinspeisung_ziel_netzleistung', e.target.value)}">
          </div>
        </div>

        <div class="config-card glass">
          <div class="c-head">📡 SENSOR ZUORDNUNG</div>
          <p class="c-desc">Bitte wähle die Sensoren aus deinem System aus.</p>
          
          <hoymiles-entity-picker .hass="${this.hass}" label="Solar Produktion (Watt)" .value="${this.config.solar_sensor || this._solarEntity}"
            @value-changed="${(e) => this.config = { ...this.config, solar_sensor: e.detail.value }}"></hoymiles-entity-picker>

          <hoymiles-entity-picker .hass="${this.hass}" label="Stromzähler / Netzbezug (Watt)" .value="${this.config.grid_sensor}"
            @value-changed="${(e) => this.config = { ...this.config, grid_sensor: e.detail.value }}"></hoymiles-entity-picker>
          
          <hoymiles-entity-picker .hass="${this.hass}" label="Batterie SOC (Prozent)" .value="${this.config.battery_sensor}"
            @value-changed="${(e) => this.config = { ...this.config, battery_sensor: e.detail.value }}"></hoymiles-entity-picker>
        </div>

        <button class="save-btn" @click="${this._saveConfig}">
           <ha-icon icon="mdi:check-circle"></ha-icon> EINSTELLUNGEN ÜBERNEHMEN
        </button>
      </div>
    `;
  }

  renderHelp() {
    return html`
      <div class="help-wrap">
        <div class="card glass">
          <h3>📘 KURZANLEITUNG</h3>
          <p>Das Panel visualisiert deine Energieströme im Kairo-Style.</p>
          <ul>
            <li><strong>Dashboard:</strong> Live-Ansicht deiner Power.</li>
            <li><strong>Einstellungen:</strong> Hier wählst du deine Sensoren aus.</li>
          </ul>
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
        display: block; background: #050507; color: #e0e0e0; min-height: 100vh;
        font-family: 'Outfit', 'Inter', sans-serif; --accent: #F7931A;
      }
      .panel-container { max-width: 1400px; margin: 0 auto; padding: 25px; }

      .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
      .logo-area { display: flex; align-items: center; gap: 15px; }
      .logo-icon { 
        font-size: 2em; background: var(--accent); width: 48px; height: 48px; 
        display: flex; align-items: center; justify-content: center; border-radius: 12px;
        box-shadow: 0 0 25px rgba(247, 147, 26, 0.4); color: #fff;
      }
      .logo-text h1 { margin: 0; font-size: 1.25em; letter-spacing: 1px; color: #fff; }
      .version-tag { font-size: 0.7em; color: var(--accent); font-weight: bold; }
      .time-area { font-size: 0.85em; color: #666; font-weight: 500; }

      .tabs { display: flex; gap: 12px; margin-bottom: 35px; }
      .tab { 
        padding: 12px 28px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
        border-radius: 8px; cursor: pointer; font-size: 0.8em; font-weight: bold; transition: 0.3s; color: #888;
      }
      .tab.active { background: var(--accent); color: #fff; border-color: var(--accent); box-shadow: 0 5px 20px rgba(247, 147, 26, 0.3); }

      .dashboard-layout { display: grid; grid-template-columns: 1fr 340px; gap: 25px; }
      .glass { background: rgba(20, 20, 25, 0.7); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }

      .main-card { padding: 35px; min-height: 700px; display: flex; flex-direction: column; }
      .card-title { font-size: 0.8em; font-weight: bold; color: #666; margin-bottom: 40px; letter-spacing: 1px; }

      .energy-visualizer { flex: 1; position: relative; }
      .top-labels { display: flex; justify-content: space-between; position: relative; z-index: 20; }
      .label-box .label { font-size: 0.8em; color: #777; margin-bottom: 4px; }
      .label-box .value { font-size: 2em; font-weight: bold; }
      .orange { color: var(--accent); text-shadow: 0 0 15px rgba(247, 147, 26, 0.4); }

      .visual-engine { position: relative; width: 600px; height: 400px; margin: 0 auto; }
      .flow-svg { position: absolute; width: 100%; height: 100%; top: 0; left: 0; }
      .flow-path { fill: none; stroke: rgba(255,255,255,0.03); stroke-width: 3; }
      .node { 
        position: absolute; width: 55px; height: 55px; border-radius: 50%;
        background: #111; border: 1px solid rgba(255,255,255,0.1);
        display: flex; align-items: center; justify-content: center; z-index: 10;
        box-shadow: 0 0 15px rgba(0,0,0,0.5);
      }
      .solar-node { color: var(--accent); border-color: var(--accent); box-shadow: 0 0 15px rgba(247, 147, 26, 0.2); }
      .house-node { color: #fff; }
      .soc-bubble { position: absolute; top: -10px; right: -10px; background: var(--accent); color: #000; font-size: 0.7em; padding: 2px 6px; border-radius: 10px; font-weight: bold; }

      .center-gauge { 
        position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
        width: 240px; height: 240px; display: flex; align-items: center; justify-content: center;
      }
      .gauge-ring { position: absolute; width: 100%; height: 100%; border: 12px solid rgba(255,255,255,0.03); border-radius: 50%; }
      .gauge-arc { 
        position: absolute; width: 100%; height: 100%; border: 12px solid transparent; 
        border-top-color: var(--accent); border-radius: 50%; filter: drop-shadow(0 0 12px var(--accent));
        transition: 1s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .gauge-content { text-align: center; }
      .gl { font-size: 0.7em; color: #777; font-weight: bold; letter-spacing: 2px; }
      .gv { font-size: 2.6em; font-weight: bold; margin: 8px 0; color: #fff; }
      .gs { font-size: 0.8em; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 5px; }

      .graph-section { margin-top: 40px; }
      .graph-header { font-size: 0.85em; font-weight: bold; color: #666; margin-bottom: 12px; display: flex; justify-content: space-between; }
      .graph-canvas { height: 100px; border-radius: 15px; position: relative; overflow: hidden; background: #000; border: 1px solid rgba(255,255,255,0.05); }
      .line { stroke: var(--accent); stroke-width: 2.5; fill: none; }
      .area { fill: linear-gradient(180deg, rgba(247, 147, 26, 0.15), transparent); }

      .stats-area { display: flex; flex-direction: column; gap: 20px; }
      .side-tile { padding: 22px; }
      .t-cap { font-size: 0.75em; font-weight: bold; color: #666; margin-bottom: 20px; letter-spacing: 1px; }
      .t-main { display: flex; align-items: center; gap: 20px; }
      .t-ico { width: 55px; height: 55px; background: rgba(255,255,255,0.03); border-radius: 14px; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.1); font-size: 1.4em; }
      .t-ico.orange { border-color: rgba(247, 147, 26, 0.2); color: var(--accent); }
      .t-rows { flex: 1; }
      .t-row { display: flex; justify-content: space-between; font-size: 0.85em; margin-bottom: 6px; }
      .t-row span:last-child { font-weight: bold; color: #fff; }

      .settings-wrap { max-width: 850px; margin: 0 auto; }
      .config-card { padding: 30px; margin-bottom: 25px; }
      .c-head { color: var(--accent); font-weight: bold; font-size: 1em; margin-bottom: 25px; }
      .s-row { display: flex; justify-content: space-between; align-items: center; padding: 20px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
      .s-label { font-size: 1.1em; font-weight: 500; }
      .s-desc { font-size: 0.8em; color: #666; margin-top: 4px; }
      .num-input { background: #000; border: 1px solid #333; color: #fff; padding: 10px 15px; border-radius: 8px; width: 120px; text-align: center; font-size: 1.1em; font-weight: bold; }
      
      .save-btn { 
        width: 100%; padding: 22px; background: var(--accent); 
        border: none; border-radius: 12px; color: #fff; font-weight: bold; cursor: pointer; transition: 0.3s;
        font-size: 1.1em; letter-spacing: 1px; display: flex; align-items: center; justify-content: center; gap: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      }
      .save-btn:hover { background: #ffaa33; transform: translateY(-2px); box-shadow: 0 15px 40px rgba(247, 147, 26, 0.3); }
      
      .green { color: #2ecc71 !important; }
      .red { color: #e74c3c !important; }
    `;
  }
}
customElements.define("hoymiles-cyd-panel", HoymilesCYDPanel);
