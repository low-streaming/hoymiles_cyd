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
      search: { type: String },
      domain: { type: String }
    };
  }

  constructor() {
    super();
    this.open = false;
    this.search = '';
    this.domain = 'sensor';
  }

  get entities() {
    if (!this.hass) return [];
    const domains = this.domain.split(',');
    return Object.keys(this.hass.states)
      .filter(id => domains.some(d => id.startsWith(d + '.')))
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
          <div class="picker-icons">
            ${this.value ? html`<ha-icon icon="mdi:close-circle" @click="${(e) => { e.stopPropagation(); this._selectItem(''); }}"></ha-icon>` : ''}
            <ha-icon icon="${this.open ? 'mdi:chevron-up' : 'mdi:chevron-down'}"></ha-icon>
          </div>
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
              `) : html`<div class="empty">Keine Entitäten gefunden (${this.domain})</div>`}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  static get styles() {
    return css`
      :host { display: block; margin-bottom: 20px; position: relative; z-index: 1; }
      :host([open]) { z-index: 9999; }
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
      .picker-icons { display: flex; align-items: center; gap: 8px; }
      .picker-icons ha-icon { --mdc-icon-size: 18px; color: #888; }
      .picker-icons ha-icon:hover { color: #F7931A; }
      .input-box:hover { border-color: #F7931A; background: rgba(30,30,35,0.9); }
      .placeholder { color: #444; }
      .dropdown { 
        position: absolute; top: 100%; left: 0; right: 0; z-index: 9999; 
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
      _historyData: { type: Array },
      _availableInverters: { type: Array }
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
      target_grid_watt: 10,
      operation_mode: 'zero_export',
      selected_inverter: 'all',
      external_limit_entity: '',
      inverter_type: 'hoymiles',
      generic_limit_type: 'watt'
    };
    this._historyData = [];
    this._configLoaded = false;
    this._availableInverters = [];
  }

  updated(changedProps) {
    if (changedProps.has('hass') && this.hass && !this._configLoaded) {
      this._loadConfig();
      this._loadInverters();
      this._configLoaded = true;
      this._fetchHistory();
      setInterval(() => this._fetchHistory(), 60000);

      this.addEventListener('click', () => {
        const pickers = this.shadowRoot.querySelectorAll('hoymiles-entity-picker');
        pickers.forEach(p => p.open = false);
      });
    }
  }

  async _loadInverters() {
    try {
      const resp = await this.hass.callApi('GET', 'hoymiles_cyd_inverters');
      this._availableInverters = resp.inverters || [];
    } catch (e) { console.error("Failed to load inverters", e); }
  }

  async _loadConfig() {
    try {
      const resp = await this.hass.callApi('GET', 'hoymiles_cyd_config');
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
      await this.hass.callApi('POST', 'hoymiles_cyd_config', this.config);
      this.dispatchEvent(new CustomEvent('hass-notification', {
        detail: { message: "Einstellungen erfolgreich gespeichert!", duration: 3000 },
        bubbles: true, composed: true
      }));
    } catch (e) { alert("Speichern fehlgeschlagen"); }
  }

  render() {
    const zero_export_status = (this.hass.states['sensor.zero_export_controller_nulleinspeisung_status'] ||
      this.hass.states['sensor.zero_export_controller_zero_export_status'])?.state || '--';

    return html`
      <div class="panel-container">
        <div class="header">
          <div class="logo-area">
            <div class="logo-icon">⚡</div>
            <div class="logo-text">
              <h1>SYSTEM: S_STEUERUNG</h1>
              <div class="status-badge">
                <span class="status-dot ${zero_export_status.includes('Läuft') ? 'active' : ''}"></span>
                <span class="status-text">${zero_export_status.toUpperCase()}</span>
              </div>
            </div>
          </div>
          <div class="time-area">
            ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} | ${new Date().toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}
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
    const getScaled = (entityId, scale) => {
      const state = this.hass.states[entityId];
      if (!state || state.state === 'unavailable' || state.state === 'unknown') return 0;
      let val = parseFloat(state.state) || 0;
      if (scale === 'kw_to_w') return val * 1000;
      if (scale === 'w_to_kw') return val / 1000;
      return val;
    };

    // Current Power (Watts)
    const solar_p = getScaled(this.config.solar_power_sensor || 'sensor.hoymiles_cyd_ac_power', this.config.solar_power_scale);
    const batt_p = getScaled(this.config.battery_power_sensor, this.config.battery_power_scale);

    let grid_p = 0;
    let house_consumption = 0;

    if (this.config.operation_mode === 'base_load') {
      let bl_power = parseFloat(this.config.static_base_load) || 0;
      for (let i = 1; i <= 6; i++) {
        const p = this.config[`base_plug_${i}`];
        if (p) {
          const s = this.hass.states[p];
          if (s && s.state !== 'unavailable' && s.state !== 'unknown') {
            bl_power += parseFloat(s.state) || 0;
          }
        }
      }
      house_consumption = bl_power;
      grid_p = house_consumption - solar_p; // Simulate grid exchange based on base load calculation
    } else {
      grid_p = getScaled(this.config.grid_sensor, this.config.grid_power_scale);
      house_consumption = Math.max(0, solar_p + grid_p + (batt_p > 0 ? 0 : Math.abs(batt_p)));
    }

    const zero_export_status = (this.hass.states['sensor.zero_export_controller_nulleinspeisung_status'] || this.hass.states['sensor.zero_export_controller_zero_export_status'])?.state || '--';
    const control_limit = (this.hass.states['sensor.zero_export_controller_nulleinspeisung_leistungslimit'] || this.hass.states['sensor.zero_export_controller_zero_export_limit'])?.state || '0';

    const gauge_deg = (parseFloat(control_limit) / 100) * 180;

    return html`
      <div class="dashboard-layout animate-fade-in">
        <div class="main-card glass">
          <div class="card-caption">ENERGIEÜBERSICHT (ZERO EXPORT)</div>
          
          <div class="visualizer">
            <div class="labels-top">
              <div class="box">
                <span class="lab">Solar Produktion</span>
                <span class="val neon-orange">${(solar_p / 1000).toFixed(2)} kW</span>
              </div>
              <div class="box right">
                <span class="lab">Haus Verbrauch</span>
                <span class="val neon-blue">${(house_consumption / 1000).toFixed(2)} kW</span>
              </div>
            </div>

            <div class="engine">
              <svg class="engine-svg" viewBox="0 0 600 420">
                <defs>
                  <linearGradient id="graphGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:var(--accent);stop-opacity:0.3" />
                    <stop offset="100%" style="stop-color:var(--accent);stop-opacity:0" />
                  </linearGradient>
                  
                  <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>
                <!-- Static Paths -->
                <path d="M 120 100 Q 300 100 300 210" class="pth" />
                <path d="M 480 100 Q 300 100 300 210" class="pth" />
                <path d="M 120 320 Q 300 320 300 210" class="pth" />
                <path d="M 480 320 Q 300 320 300 210" class="pth" />
                
                <!-- Active Flows -->
                ${solar_p > 20 ? html`
                  <path d="M 120 100 Q 300 100 300 210" class="pth-active neon-orange-stroke" />
                  <circle r="6" fill="#fff" filter="url(#neonGlow)" class="neon-orange-glow">
                    <animateMotion dur="${Math.max(0.5, 3 - solar_p / 1000)}s" repeatCount="indefinite" path="M 120 100 Q 300 100 300 210" />
                  </circle>
                ` : ''}
                
                ${house_consumption > 20 ? html`
                  <path d="M 480 100 Q 300 100 300 210" class="pth-active neon-blue-stroke" style="animation-direction: reverse;" />
                  <circle r="6" fill="#fff" filter="url(#neonGlow)" class="neon-blue-glow">
                    <animateMotion dur="${Math.max(0.5, 3 - house_consumption / 1000)}s" repeatCount="indefinite" path="M 300 210 Q 300 100 480 100" />
                  </circle>
                ` : ''}

                ${grid_p > 20 ? html`
                  <path d="M 120 320 Q 300 320 300 210" class="pth-active neon-pink-stroke" />
                  <circle r="6" fill="#fff" filter="url(#neonGlow)" class="neon-pink-glow">
                    <animateMotion dur="${Math.max(0.5, 4 - grid_p / 1000)}s" repeatCount="indefinite" path="M 120 320 Q 300 320 300 210" />
                  </circle>
                ` : html`${grid_p < -20 ? html`
                  <path d="M 120 320 Q 300 320 300 210" class="pth-active neon-cyan-stroke" style="animation-direction: reverse;" />
                  <circle r="6" fill="#fff" filter="url(#neonGlow)" class="neon-cyan-glow">
                    <animateMotion dur="${Math.max(0.5, 4 - Math.abs(grid_p) / 1000)}s" repeatCount="indefinite" path="M 300 210 Q 300 320 120 320" />
                  </circle>
                ` : ''}`}

                ${Math.abs(batt_p) > 20 ? html`
                  <path d="M 480 320 Q 300 320 300 210" class="pth-active neon-green-stroke" style="${batt_p > 0 ? 'animation-direction: reverse;' : ''}" />
                  <circle r="6" fill="#fff" filter="url(#neonGlow)" class="neon-green-glow">
                    <animateMotion dur="${Math.max(0.5, 4 - Math.abs(batt_p) / 1000)}s" repeatCount="indefinite" 
                      path="${batt_p > 0 ? 'M 300 210 Q 300 320 480 320' : 'M 480 320 Q 300 320 300 210'}" />
                  </circle>
                ` : ''}
              </svg>

              <div class="node n-solar neon-border-orange" style="top: 68px; left: 88px;"><ha-icon icon="mdi:solar-panel-large"></ha-icon></div>
              <div class="node n-house neon-border-blue" style="top: 68px; right: 88px;"><ha-icon icon="mdi:home-lightning-bolt"></ha-icon></div>
              <div class="node n-grid neon-border-pink" style="bottom: 68px; left: 88px;"><ha-icon icon="mdi:transmission-tower"></ha-icon></div>
              <div class="node n-batt neon-border-green" style="bottom: 68px; right: 88px;">
                <ha-icon icon="mdi:battery-high"></ha-icon>
                ${battery_soc ? html`<div class="soc-tag neon-bg-green">${battery_soc}%</div>` : ''}
              </div>

              <div class="gauge-center">
                <div class="g-ring"></div>
                <div class="g-arc" style="transform: rotate(${gauge_deg}deg)"></div>
                <div class="g-inner">
                   <div class="g-cap">NETZBILANZ</div>
                   <div class="g-main">${Math.abs(grid_p)}<span style="font-size: 0.4em; margin-left: 4px;">W</span></div>
                   <div class="g-stat ${grid_p >= 0 ? 'red' : 'green'}">
                      <ha-icon icon="${grid_p >= 0 ? 'mdi:arrow-down-bold' : 'mdi:arrow-up-bold'}"></ha-icon>
                      ${grid_p >= 0 ? 'IMPORT' : 'EXPORT'}
                   </div>
                </div>
              </div>
            </div>

            <div class="flow-legend">
              <div class="leg-item"><span class="dot neon-orange-bg"></span> Solar</div>
              <div class="leg-item"><span class="dot neon-blue-bg"></span> Haus</div>
              <div class="leg-item"><span class="dot neon-pink-bg"></span> Netz Import</div>
              <div class="leg-item"><span class="dot neon-cyan-bg"></span> Netz Export</div>
              <div class="leg-item"><span class="dot neon-green-bg"></span> Batterie</div>
            </div>
          </div>


          <div class="graph-area">
             <div class="graph-info">
               <span>ENERGIEMESSUNG (NETZLEISTUNG)</span>
               <span class="range">LETZTE STUNDE</span>
             </div>
             <div class="canvas">
                <svg viewBox="0 0 500 120" preserveAspectRatio="none">
                  <path d="${this._generateGraphPath(true)}" class="area-f" />
                  <path d="${this._generateGraphPath()}" class="line-f" />
                </svg>
             </div>
          </div>
        </div>

        <div class="sidebar">
          <div class="side-card glass">
            <div class="s-cap">WECHSELRICHTER STATUS</div>
            <div class="s-flex">
              <div class="s-icon"><ha-icon icon="mdi:server-network"></ha-icon></div>
              <div class="s-vals">
                <div class="s-row"><span>Status</span> <span class="green">AKTIV ●</span></div>
                <div class="s-row"><span>Heute Ertrag</span> <span>${yield_today.toFixed(2)} kWh</span></div>
                <div class="s-row"><span>Temperatur</span> <span>${inverter_temp}°C</span></div>
              </div>
            </div>
          </div>

          <div class="side-card glass">
            <div class="s-cap">ENERGIE FLÜSSE</div>
            <div class="s-flex">
              <div class="s-icon orange"><ha-icon icon="mdi:transmission-tower"></ha-icon></div>
              <div class="s-vals">
                <div class="s-row"><span>Netz Bezug</span> <span>${import_today.toFixed(2)} kWh</span></div>
                <div class="s-row"><span>Netz Einspeisung</span> <span>${export_today.toFixed(2)} kWh</span></div>
              </div>
            </div>
          </div>

          <div class="side-card glass">
            <div class="s-cap">STEUERUNG (ZEN)</div>
            <div class="s-flex">
              <div class="s-icon orange"><ha-icon icon="mdi:target-variant"></ha-icon></div>
              <div class="s-vals">
                <div class="s-row"><span>Leistungslimit</span> <span>${control_limit}%</span></div>
                <div class="s-row"><span>Effizienz</span> <span class="orange">OPTIMAL</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }


  _generateGraphPath(fill = false) {
    if (!this._historyData || this._historyData.length < 2) return "";
    const w = 500, h = 120;
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
      <div class="settings-page animate-fade-in">
        <div class="setup-header">
           <div class="setup-title">S_SETUP: KONFIGURATION</div>
           <div class="setup-step">Schritt-für-Schritt Einrichtung für optimale Nulleinspeisung.</div>
        </div>

        <!-- STEUERUNG & SYSTEM -->
        <div class="config-grid">
          <div class="config-section glass">
             <div class="section-title"><ha-icon icon="mdi:tune-vertical"></ha-icon> STEUERUNG</div>
             
             <div class="cfg-row">
                <div class="cfg-info">
                   <div class="cfg-label">Automatisierung</div>
                   <div class="cfg-desc">Nulleinspeisung ein- oder ausschalten.</div>
                </div>
                <ha-switch .checked="${this.config.is_enabled || false}"
                  @change="${(e) => { this.config = { ...this.config, is_enabled: e.target.checked }; this._handleSwitchChange(e.target.checked); }}"></ha-switch>
             </div>

             <div class="cfg-row">
                <div class="cfg-info">
                   <div class="cfg-label">Betriebsmodus</div>
                   <div class="cfg-desc">ZEN = Automatisch, Manuell = Fester Wert.</div>
                </div>
                <select class="cfg-select" .value="${this.config.operation_mode || 'zero_export'}"
                  @change="${(e) => this.config = { ...this.config, operation_mode: e.target.value }}">
                   <option value="zero_export">ZEN (Automatik)</option>
                   <option value="base_load">Grundlast (Plugs)</option>
                   <option value="manual_limit">Manuell (%)</option>
                   <option value="disabled">Inaktiv</option>
                </select>
             </div>

             <div class="cfg-row">
                <div class="cfg-info">
                   <div class="cfg-label">Hardware-System</div>
                   <div class="cfg-desc">Welches Gerät wird gesteuert?</div>
                </div>
                <select class="cfg-select" .value="${this.config.inverter_type || 'hoymiles'}"
                  @change="${(e) => this.config = { ...this.config, inverter_type: e.target.value }}">
                   <option value="hoymiles">Hoymiles (DTU)</option>
                   <option value="opendtu">OpenDTU / AhoyDTU</option>
                   <option value="generic">Anderes (EZ1/HA)</option>
                </select>
             </div>

             ${this.config.inverter_type === 'hoymiles' ? html`
                <div class="cfg-row">
                   <div class="cfg-info">
                      <div class="cfg-label">Ziel-Inverter</div>
                      <div class="cfg-desc">Alle oder spezifische Seriennummer.</div>
                   </div>
                   <select class="cfg-select" .value="${this.config.selected_inverter || 'all'}"
                     @change="${(e) => this.config = { ...this.config, selected_inverter: e.target.value }}">
                      <option value="all">Alle Geräte</option>
                      ${this._availableInverters.map(sn => html`<option value="${sn}">${sn}</option>`)}
                   </select>
                </div>
             ` : html`
                <div class="cfg-row column">
                   <div class="cfg-info">
                      <div class="cfg-label">External Limit Entity</div>
                   </div>
                   <hoymiles-entity-picker .hass="${this.hass}" label="Number / Limit Entity" .value="${this.config.external_limit_entity}" domain="number,input_number"
                     @value-changed="${(e) => this.config = { ...this.config, external_limit_entity: e.detail.value }}"></hoymiles-entity-picker>
                </div>
                <div class="cfg-row">
                   <div class="cfg-info">
                      <div class="cfg-label">Limit Einheit</div>
                   </div>
                   <select class="cfg-select" .value="${this.config.generic_limit_type || 'watt'}"
                     @change="${(e) => this.config = { ...this.config, generic_limit_type: e.target.value }}">
                      <option value="watt">Watt (W)</option>
                      <option value="percent">Prozent (%)</option>
                   </select>
                </div>
             `}
          </div>

          <!-- INTELLIGENZ & LIMITS -->
          <div class="config-section glass">
             <div class="section-title"><ha-icon icon="mdi:brain"></ha-icon> INTELLIGENZ</div>
             
             <div class="cfg-row">
                <div class="cfg-info">
                   <div class="cfg-label">Ziel-Bezug am Zähler</div>
                   <div class="cfg-desc">Gewünschter Wert in Watt (z.B. 10W Netzbezug).</div>
                </div>
                <div class="input-wrap">
                   <input type="number" class="cfg-num" .value="${this.config.target_grid_watt || 0}"
                     @change="${(e) => this.config = { ...this.config, target_grid_watt: e.target.value }}">
                   <span class="unit-tag">W</span>
                </div>
             </div>

             <div class="cfg-row">
                <div class="cfg-info">
                   <div class="cfg-label">Maximale Kapazität</div>
                   <div class="cfg-desc">Max. AC-Leistung aller WR (z.B. 800W).</div>
                </div>
                <div class="input-wrap">
                   <input type="number" class="cfg-num" .value="${this.config.max_capacity || 800}"
                     @change="${(e) => this.config = { ...this.config, max_capacity: e.target.value }}">
                   <span class="unit-tag">W</span>
                </div>
             </div>

             <div class="info-box-neon">
                <ha-icon icon="mdi:information-outline"></ha-icon>
                <span>Die Automatik (ZEN) berechnet sekündlich das optimale Limit für deine Wechselrichter.</span>
             </div>
          </div>
        </div>

        <!-- SENSORIK Sektion -->
        <div class="config-section glass sensor-section">
           <div class="section-title"><ha-icon icon="mdi:nas"></ha-icon> SENSOR ZUORDNUNG</div>
           <p class="section-lead">Wähle hier deine Home Assistant Sensoren aus. Die Skalierung erlaubt die Umrechnung von kW zu W.</p>
           
           <div class="picker-grid">
              <div class="p-card">
                <div class="p-head"><ha-icon icon="mdi:solar-power"></ha-icon> Solar Leistung (W)</div>
                <hoymiles-entity-picker .hass="${this.hass}" label="Entität wählen" .value="${this.config.solar_power_sensor}"
                  @value-changed="${(e) => this.config = { ...this.config, solar_power_sensor: e.detail.value }}"></hoymiles-entity-picker>
                <div class="u-sel">
                   <select @change="${(e) => this.config = { ...this.config, solar_power_scale: e.target.value }}">
                      <option value="none" ?selected="${this.config.solar_power_scale === 'none'}">Daten sind in Watt</option>
                      <option value="kw_to_w" ?selected="${this.config.solar_power_scale === 'kw_to_w'}">Eingang ist kW -> zu W</option>
                   </select>
                </div>
              </div>

              <div class="p-card">
                <div class="p-head"><ha-icon icon="mdi:transmission-tower"></ha-icon> Stromzähler (W)</div>
                <hoymiles-entity-picker .hass="${this.hass}" label="Entität wählen" .value="${this.config.grid_sensor}"
                  @value-changed="${(e) => this.config = { ...this.config, grid_sensor: e.detail.value }}"></hoymiles-entity-picker>
                <div class="u-sel">
                   <select @change="${(e) => this.config = { ...this.config, grid_power_scale: e.target.value }}">
                      <option value="none" ?selected="${this.config.grid_power_scale === 'none'}">Daten sind in Watt</option>
                      <option value="kw_to_w" ?selected="${this.config.grid_power_scale === 'kw_to_w'}">Eingang ist kW -> zu W</option>
                   </select>
                </div>
              </div>

              <div class="p-card">
                <div class="p-head"><ha-icon icon="mdi:battery-high"></ha-icon> Batterie SOC (%)</div>
                <hoymiles-entity-picker .hass="${this.hass}" label="Entität wählen" .value="${this.config.battery_soc_sensor}"
                  @value-changed="${(e) => this.config = { ...this.config, battery_soc_sensor: e.detail.value }}"></hoymiles-entity-picker>
              </div>

              <div class="p-card">
                <div class="p-head"><ha-icon icon="mdi:battery-charging"></ha-icon> Batterie Leistung (W)</div>
                <hoymiles-entity-picker .hass="${this.hass}" label="Entität wählen" .value="${this.config.battery_power_sensor}"
                  @value-changed="${(e) => this.config = { ...this.config, battery_power_sensor: e.detail.value }}"></hoymiles-entity-picker>
              </div>

              <div class="p-card">
                <div class="p-head"><ha-icon icon="mdi:chart-line"></ha-icon> Solar Ertrag Heute</div>
                <hoymiles-entity-picker .hass="${this.hass}" label="Entität wählen" .value="${this.config.solar_energy_yield_sensor}"
                  @value-changed="${(e) => this.config = { ...this.config, solar_energy_yield_sensor: e.detail.value }}"></hoymiles-entity-picker>
                <div class="u-sel">
                   <select @change="${(e) => this.config = { ...this.config, solar_yield_scale: e.target.value }}">
                      <option value="none" ?selected="${this.config.solar_yield_scale === 'none'}">Daten sind in kWh</option>
                      <option value="w_to_kw" ?selected="${this.config.solar_yield_scale === 'w_to_kw'}">Eingang ist Wh -> zu kWh</option>
                   </select>
                </div>
              </div>
        </div>

        <!-- GRUNDLAST SEKTION -->
        <div class="config-section glass sensor-section" style="margin-top: 20px;">
           <div class="section-title"><ha-icon icon="mdi:power-plug"></ha-icon> GRUNDLAST PLUGS</div>
           <p class="section-lead">Diese Sensoren werden summiert, wenn 'Grundlast' als Betriebsmodus gewählt ist.</p>
           
           <div class="cfg-row" style="margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 15px;">
              <div class="cfg-info">
                 <div class="cfg-label">Statische Grundlast</div>
                 <div class="cfg-desc">Fester Watt-Wert, der immer addiert wird.</div>
              </div>
              <div class="input-wrap">
                 <input type="number" class="cfg-num" .value="${this.config.static_base_load || 0}"
                   @change="${(e) => this.config = { ...this.config, static_base_load: e.target.value }}">
                 <span class="unit-tag">W</span>
              </div>
           </div>

           <div class="picker-grid">
              ${[1, 2, 3, 4, 5, 6].map(i => html`
                <div class="p-card min-card">
                   <div class="p-head">Plug ${i} (Watt)</div>
                   <hoymiles-entity-picker .hass="${this.hass}" label="Sensor wählen" .value="${this.config['base_plug_' + i]}"
                     @value-changed="${(e) => this.config = { ...this.config, ['base_plug_' + i]: e.detail.value }}"></hoymiles-entity-picker>
                </div>
              `)}
           </div>
        </div>

        <button class="mega-save-btn" @click="${this._saveConfig}">
           <ha-icon icon="mdi:content-save-check"></ha-icon>
           EINSTELLUNGEN ÜBERNEHMEN
        </button>
      </div>
    `;
  }

  renderHelp() {
    return html`
      <div class="help-page glass animate-fade-in">
      <div class="help-content animate-fade-in glass">
        <div class="help-header">
           <ha-icon icon="mdi:book-open-variant"></ha-icon>
           <h3>HOYMILES CYD - BEDIENUNGSANLEITUNG</h3>
        </div>
        
        <div class="help-grid">
          <div class="help-section">
            <h4><ha-icon icon="mdi:rocket-launch"></ha-icon> 1. ERSTE SCHRITTE</h4>
            <p>Um die Nulleinspeisung (ZEN) zu nutzen, musst du zuerst deine Hardware definieren:</p>
            <ul>
              <li><strong>Hoymiles DTU:</strong> Direkte Steuerung über die offizielle DTU.</li>
              <li><strong>OpenDTU / AhoyDTU:</strong> Steuerung über MQTT-Entities (typischerweise ein <code>number</code>-Sensor für das Limit).</li>
            </ul>
          </div>

          <div class="help-section">
            <h4><ha-icon icon="mdi:tune"></ha-icon> 2. SENSOR-MAPPING</h4>
            <p>Damit die Logik weiß, wie viel Strom gerade verbraucht wird, verknüpfe unter <strong>EINSTELLUNGEN</strong>:</p>
            <ul>
              <li><strong>Stromzähler:</strong> Dein Hauptzähler (Watt). Positive Werte = Bezug, Negative = Einspeisung.</li>
              <li><strong>Solar Leistung:</strong> Die aktuelle Erzeugung deiner Wechselrichter.</li>
              <li><strong>Skalierung:</strong> Falls deine Sensoren kW statt W liefern, nutze den integrierten Konverter.</li>
            </ul>
          </div>

          <div class="help-section">
            <h4><ha-icon icon="mdi:brain"></ha-icon> 3. DIE ZEN-AUTOMATIK</h4>
            <p>Der <strong>Zero Export Network (ZEN)</strong> Algorithmus berechnet jede Sekunde das optimale Limit:</p>
            <ul>
              <li><strong>Ziel-Bezug:</strong> Ein kleiner Puffer (z.B. 10W) verhindert, dass Regelverzögerungen zur ungewollten Einspeisung führen.</li>
              <li><strong>Max. Kapazität:</strong> Gib hier die maximale AC-Leistung deiner Inverter an (z.B. 800W).</li>
            </ul>
          </div>

          <div class="help-section">
            <h4><ha-icon icon="mdi:alert-circle-outline"></ha-icon> 4. FEHLERBEHEBUNG</h4>
            <p>Solltest du Probleme haben:</p>
            <ul>
              <li><strong>Schalter reagiert nicht:</strong> Seite neu laden (Browser-Cache).</li>
              <li><strong>Limit wird nicht gesetzt:</strong> Prüfe, ob die "External Limit Entity" korrekt beschreibbar ist.</li>
              <li><strong>Falsche Werte:</strong> Kontrolliere die Einheiten (Watt vs. Prozent).</li>
            </ul>
          </div>
        </div>

        <div class="help-footer">
          <div class="footer-line"></div>
          <p><strong>Low Streaming by OpenKairo</strong> | AGPL-3.0 Lizenz</p>
        </div>
      </div>
    `;
  }

  _toggleSwitch(entity) { this.hass.callService('switch', 'toggle', { entity_id: entity }); }

  _handleSwitchChange(on) {
    const ids = ['switch.zero_export_controller_nulleinspeisung_aktivieren', 'switch.zero_export_controller_zero_export_enabled'];
    const service = on ? 'turn_on' : 'turn_off';
    for (const id of ids) {
      if (this.hass.states[id]) {
        this.hass.callService('switch', service, { entity_id: id });
        this.requestUpdate();
        return;
      }
    }
  }

  _setNumber(entity, value) { this.hass.callService('number', 'set_value', { entity_id: entity, value: value }); }

  static get styles() {
    return css`
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap');

      :host { 
        display: block; 
        background: radial-gradient(circle at 50% -20%, #1a1a1f 0%, #050505 100%);
        color: #f0f0f0; 
        min-height: 100vh; 
        padding-bottom: 50px;
        font-family: 'Outfit', sans-serif; 
        --accent: #F7931A; 
        --accent-glow: rgba(247, 147, 26, 0.4);
        --bg-panel: rgba(18, 18, 22, 0.75);
        --glass-border: rgba(255, 255, 255, 0.08);
        --text-dim: #8e8e93;
        
        --neon-orange: #ff9d00;
        --neon-blue: #00d2ff;
        --neon-green: #39ff14;
        --neon-pink: #ff007f;
        --neon-cyan: #00f3ff;
        
        overflow-x: hidden;
      }

      .neon-orange { color: var(--neon-orange); filter: drop-shadow(0 0 10px var(--neon-orange)); }
      .neon-blue { color: var(--neon-blue); filter: drop-shadow(0 0 10px var(--neon-blue)); }
      .neon-green { color: var(--neon-green); filter: drop-shadow(0 0 10px var(--neon-green)); }
      .neon-pink { color: var(--neon-pink); filter: drop-shadow(0 0 10px var(--neon-pink)); }
      
      .neon-orange-stroke { stroke: var(--neon-orange) !important; filter: drop-shadow(0 0 5px var(--neon-orange)); }
      .neon-blue-stroke { stroke: var(--neon-blue) !important; filter: drop-shadow(0 0 5px var(--neon-blue)); }
      .neon-pink-stroke { stroke: var(--neon-pink) !important; filter: drop-shadow(0 0 5px var(--neon-pink)); }
      .neon-cyan-stroke { stroke: var(--neon-cyan) !important; filter: drop-shadow(0 0 5px var(--neon-cyan)); }
      .neon-green-stroke { stroke: var(--neon-green) !important; filter: drop-shadow(0 0 5px var(--neon-green)); }

      .neon-orange-glow { fill: var(--neon-orange) !important; }
      .neon-blue-glow { fill: var(--neon-blue) !important; }
      .neon-pink-glow { fill: var(--neon-pink) !important; }
      .neon-cyan-glow { fill: var(--neon-cyan) !important; }
      .neon-green-glow { fill: var(--neon-green) !important; }

      .neon-border-orange { border-color: var(--neon-orange) !important; box-shadow: 0 0 15px rgba(255, 157, 0, 0.2) !important; color: var(--neon-orange); }
      .neon-border-blue { border-color: var(--neon-blue) !important; box-shadow: 0 0 15px rgba(0, 210, 255, 0.2) !important; color: var(--neon-blue); }
      .neon-border-pink { border-color: var(--neon-pink) !important; box-shadow: 0 0 15px rgba(255, 0, 127, 0.2) !important; color: var(--neon-pink); }
      .neon-border-green { border-color: var(--neon-green) !important; box-shadow: 0 0 15px rgba(57, 255, 20, 0.2) !important; color: var(--neon-green); }
      
      .status-badge {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 4px;
      }
      .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #ff4d4d;
        box-shadow: 0 0 8px #ff4d4d;
      }
      .status-dot.active {
        background: var(--neon-green);
        box-shadow: 0 0 8px var(--neon-green);
      }
      .status-text {
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 1px;
        color: var(--text-dim);
      }

      .neon-bg-green { background: var(--neon-green) !important; color: #000; box-shadow: 0 0 15px var(--neon-green); }

      .flow-legend { 
        display: flex; justify-content: center; gap: 20px; margin-top: 30px; 
        padding: 15px; background: rgba(0,0,0,0.2); border-radius: 15px; border: 1px solid var(--glass-border);
      }
      .leg-item { display: flex; align-items: center; gap: 8px; font-size: 0.8em; font-weight: 600; color: var(--text-dim); }
      .dot { width: 10px; height: 10px; border-radius: 50%; }
      .neon-orange-bg { background: var(--neon-orange); box-shadow: 0 0 8px var(--neon-orange); }
      .neon-blue-bg { background: var(--neon-blue); box-shadow: 0 0 8px var(--neon-blue); }
      .neon-pink-bg { background: var(--neon-pink); box-shadow: 0 0 8px var(--neon-pink); }
      .neon-cyan-bg { background: var(--neon-cyan); box-shadow: 0 0 8px var(--neon-cyan); }
      .neon-green-bg { background: var(--neon-green); box-shadow: 0 0 8px var(--neon-green); }

      .p-group { border: 1px solid var(--glass-border); border-radius: 18px; padding: 15px; background: rgba(255,255,255,0.02); }
      .unit-row { margin-top: 10px; display: flex; gap: 10px; }
      .unit-row select { 
        background: #000; color: #fff; border: 1px solid var(--accent); 
        padding: 8px 12px; border-radius: 8px; font-size: 0.8em; outline: none; width: 100%;
        cursor: pointer; transition: 0.3s;
      }
      .unit-row select:hover { border-color: #fff; background: #111; }

      * { box-sizing: border-box; }

      .animate-fade-in { animation: fadeIn 0.8s ease-out forwards; }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

      .panel-container { max-width: 1400px; margin: 0 auto; padding: 30px; transition: padding 0.3s; }

      @media (max-width: 768px) {
        .panel-container { padding: 15px; }
      }

      /* --- HEADER --- */
      .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
      .logo-area { display: flex; align-items: center; gap: 20px; }
      .logo-icon { 
        font-size: 1.8em; background: linear-gradient(135deg, var(--accent) 0%, #ff6e00 100%); 
        width: 54px; height: 54px; display: flex; align-items: center; justify-content: center; 
        border-radius: 16px; box-shadow: 0 8px 30px var(--accent-glow); color: #fff; 
        animation: pulse-glow 3s infinite;
      }
      @keyframes pulse-glow { 
        0%, 100% { box-shadow: 0 0 20px var(--accent-glow); transform: scale(1); } 
        50% { box-shadow: 0 0 40px var(--accent-glow); transform: scale(1.02); } 
      }
      .logo-text h1 { margin: 0; font-size: 1.4em; letter-spacing: 2px; font-weight: 800; color: #fff; text-transform: uppercase; }
      .version-tag { font-size: 0.75em; color: var(--accent); font-weight: 700; letter-spacing: 1px; display: flex; align-items: center; gap: 6px; }
      .version-tag::before { content: ''; width: 8px; height: 8px; background: var(--accent); border-radius: 50%; display: inline-block; box-shadow: 0 0 10px var(--accent); }
      .time-area { font-family: 'JetBrains Mono', monospace; font-size: 0.9em; color: var(--text-dim); background: rgba(255,255,255,0.03); padding: 8px 16px; border-radius: 12px; border: 1px solid var(--glass-border); }

      @media (max-width: 600px) {
        .header { flex-direction: column; align-items: flex-start; gap: 20px; }
        .time-area { width: 100%; text-align: center; }
        .logo-text h1 { font-size: 1.2em; }
      }

      /* --- TABS --- */
      .tabs { display: flex; gap: 10px; margin-bottom: 30px; flex-wrap: wrap; }
      .tab { 
        padding: 10px 24px; background: rgba(255,255,255,0.02); border: 1px solid var(--glass-border); 
        border-radius: 12px; cursor: pointer; font-size: 0.8em; font-weight: 600; transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1); 
        color: var(--text-dim); letter-spacing: 1px; flex: 1; text-align: center; min-width: 100px;
      }
      .tab:hover { background: rgba(255,255,255,0.05); color: #fff; transform: translateY(-2px); }
      .tab.active { background: var(--accent); color: #fff; border-color: var(--accent); box-shadow: 0 10px 30px var(--accent-glow); }

      /* --- LAYOUT --- */
      .dashboard-layout { display: grid; grid-template-columns: 1fr 360px; gap: 30px; }
      .glass { 
        background: var(--bg-panel); backdrop-filter: blur(40px); -webkit-backdrop-filter: blur(40px);
        border: 1px solid var(--glass-border); border-radius: 28px; 
        box-shadow: 0 25px 80px rgba(0,0,0,0.5); overflow: hidden;
        transition: all 0.4s ease;
      }
      .glass:hover { border-color: rgba(255,255,255,0.15); }

      /* --- MAIN DASHBOARD --- */
      .main-card { padding: 45px; min-height: 750px; display: flex; flex-direction: column; position: relative; }
      .main-card::before {
        content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
      }
      .card-caption { font-size: 0.85em; font-weight: 700; color: var(--text-dim); margin-bottom: 60px; letter-spacing: 2px; text-transform: uppercase; }

      .visualizer { flex: 1; position: relative; }
      .labels-top { display: flex; justify-content: space-between; position: relative; z-index: 50; }
      .labels-top .box { background: rgba(0,0,0,0.2); padding: 15px 25px; border-radius: 18px; border: 1px solid var(--glass-border); }
      .lab { font-size: 0.75em; color: var(--text-dim); margin-bottom: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
      .val { font-size: 2.6em; font-weight: 800; font-family: 'JetBrains Mono', monospace; letter-spacing: -1px; }
      .orange { color: var(--accent); filter: drop-shadow(0 0 12px var(--accent-glow)); }

      /* --- POWER CORE ENGINE --- */
      .engine { position: relative; width: 100%; max-width: 600px; height: auto; aspect-ratio: 600/420; margin: 0 auto; overflow: visible; }
      .engine-svg { position: absolute; width: 100%; height: 100%; filter: drop-shadow(0 0 8px rgba(0,0,0,0.5)); }
      .pth { fill: none; stroke: rgba(255,255,255,0.06); stroke-width: 5; stroke-linecap: round; }
      .pth-active { stroke: var(--accent); stroke-width: 6; stroke-dasharray: 10 15; opacity: 0.3; filter: blur(2px); animation: flow-dash 1s linear infinite; }
      @keyframes flow-dash { from { stroke-dashoffset: 25; } to { stroke-dashoffset: 0; } }

      .node { 
        position: absolute; width: 64px; height: 64px; border-radius: 20px; 
        background: #0d0d0f; border: 1.5px solid rgba(255,255,255,0.1); 
        display: flex; align-items: center; justify-content: center; z-index: 10; 
        font-size: 1.6em; box-shadow: 0 10px 25px rgba(0,0,0,0.4);
        transition: 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      .node:hover { transform: scale(1.15) rotate(5deg); border-color: rgba(255,255,255,0.3); }
      .n-solar { color: var(--accent); border-color: rgba(247, 147, 26, 0.4); box-shadow: 0 0 25px rgba(247, 147, 26, 0.15); }
      .n-house { color: #fff; border-color: rgba(255,255,255,0.2); }
      .n-grid { color: #8e8e93; border-color: rgba(255,255,255,0.1); }
      .n-batt { color: #2ecc71; border-color: rgba(46, 204, 113, 0.3); }
      
      .soc-tag { 
        position: absolute; top: -14px; right: -14px; background: #2ecc71; color: #000; 
        font-size: 0.75em; font-weight: 800; padding: 4px 10px; border-radius: 12px; 
        box-shadow: 0 4px 12px rgba(46, 204, 113, 0.4);
      }

      .gauge-center { 
        position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); 
        display: flex; flex-direction: column; align-items: center; justify-content: center; 
        width: 45%; height: auto; aspect-ratio: 1/1; z-index: 5;
      }
      .g-ring { position: absolute; width: 100%; height: 100%; border: 16px solid rgba(255,255,255,0.02); border-radius: 50%; }
      .g-arc { 
        position: absolute; width: 100%; height: 100%; border: 16px solid transparent; 
        border-top-color: var(--accent); border-radius: 50%; 
        filter: drop-shadow(0 0 15px var(--accent)); transition: 1.5s cubic-bezier(0.4, 0, 0.2, 1); 
      }
      .g-inner { text-align: center; z-index: 10; background: radial-gradient(circle, rgba(20,20,25,0.95) 0%, transparent 80%); width: 85%; height: 85%; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 50%; }
      .g-cap { font-size: min(0.75em, 3vw); color: var(--text-dim); font-weight: 700; margin-bottom: 5px; letter-spacing: 1px; }
      .g-main { font-size: min(3.4em, 12vw); font-weight: 800; color: #fff; font-family: 'JetBrains Mono', monospace; line-height: 1; letter-spacing: -2px; }
      .g-stat { font-size: min(0.9em, 4vw); font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 8px; padding: 4px 12px; border-radius: 20px; background: rgba(255,255,255,0.03); }

      /* --- GRAPH --- */
      .graph-area { margin-top: 60px; background: rgba(0,0,0,0.15); padding: 25px; border-radius: 24px; border: 1px solid var(--glass-border); }
      .graph-info { font-size: 0.9em; font-weight: 700; color: var(--text-dim); margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
      .graph-info .range { font-size: 0.8em; color: var(--accent); border: 1px solid rgba(247, 147, 26, 0.3); padding: 2px 8px; border-radius: 6px; }
      .canvas { height: 120px; border-radius: 18px; overflow: hidden; background: #08080a; position: relative; border: 1px solid rgba(255,255,255,0.03); }
      .line-f { stroke: var(--accent); stroke-width: 3; fill: none; filter: drop-shadow(0 0 8px var(--accent-glow)); }
      .area-f { fill: url(#graphGradient); pointer-events: none; }

      /* --- SIDEBAR --- */
      .sidebar { display: flex; flex-direction: column; gap: 25px; }
      .side-card { padding: 30px; position: relative; }
      .side-card::after { 
        content: ''; position: absolute; top: 0; left: 0; width: 4px; height: 100%; 
        background: var(--accent); opacity: 0; transition: 0.3s;
      }
      .side-card:hover::after { opacity: 1; }
      .side-card:hover { transform: translateX(5px); background: rgba(255,255,255,0.05); }

      .s-cap { font-size: 0.8em; font-weight: 800; color: var(--text-dim); margin-bottom: 25px; letter-spacing: 1.5px; text-transform: uppercase; }
      .s-flex { display: flex; align-items: flex-start; gap: 24px; }
      .s-icon { 
        width: 60px; height: 60px; background: rgba(255,255,255,0.03); border-radius: 18px; 
        display: flex; align-items: center; justify-content: center; font-size: 1.6em; 
        border: 1px solid var(--glass-border); color: #fff;
        box-shadow: inset 0 0 15px rgba(255,255,255,0.02);
      }
      .s-icon.orange { color: var(--accent); border-color: rgba(247, 147, 26, 0.15); background: rgba(247, 147, 26, 0.03); }
      .s-vals { flex: 1; }
      .s-row { display: flex; justify-content: space-between; font-size: 0.95em; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.03); }
      .s-row:last-child { border-bottom: none; }
      .s-row span:first-child { color: var(--text-dim); font-weight: 500; }
      .s-row span:last-child { font-weight: 700; color: #fff; font-family: 'JetBrains Mono', monospace; }

      .settings-page { max-width: 1200px; margin: 0 auto; animation: slideUp 0.6s ease-out; }
      @keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
      
      .setup-header { margin-bottom: 40px; border-left: 4px solid var(--accent); padding-left: 25px; }
      .setup-title { font-size: 1.8em; font-weight: 900; letter-spacing: 2px; color: #fff; }
      .setup-step { font-size: 1em; color: var(--text-dim); margin-top: 5px; }

      .config-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 30px; margin-bottom: 30px; }
      @media (max-width: 900px) {
        .config-grid { grid-template-columns: 1fr; }
      }
      .config-section { padding: 40px; position: relative; }
      @media (max-width: 600px) {
        .config-section { padding: 25px; }
      }
      .section-title { color: var(--accent); font-weight: 800; margin-bottom: 30px; font-size: 1.25em; letter-spacing: 1px; display: flex; align-items: center; gap: 15px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 15px; }
      .section-lead { color: var(--text-dim); margin-bottom: 35px; font-size: 1.1em; line-height: 1.6; }

      .cfg-row { display: flex; justify-content: space-between; align-items: center; padding: 20px 0; border-bottom: 1px solid rgba(255,255,255,0.03); gap: 20px; }
      .cfg-row.column { flex-direction: column; align-items: stretch; }
      .cfg-label { font-size: 1.1em; font-weight: 700; color: #fff; margin-bottom: 4px; }
      .cfg-desc { font-size: 0.85em; color: var(--text-dim); }
      
      .input-wrap { position: relative; display: flex; align-items: center; }
      .unit-tag { position: absolute; right: 15px; color: var(--accent); font-weight: 800; font-size: 0.9em; pointer-events: none; }

      .cfg-num { 
        background: rgba(0,0,0,0.3); border: 1.5px solid var(--glass-border); color: #fff; 
        padding: 12px 20px; border-radius: 12px; width: 140px; text-align: left; 
        font-family: 'JetBrains Mono', monospace; font-size: 1.1em; outline: none; transition: 0.3s;
      }
      .cfg-num:focus { border-color: var(--accent); background: #000; box-shadow: 0 0 15px var(--accent-glow); }
      
      .cfg-select {
        background: rgba(40,40,45,0.5); border: 1.5px solid var(--glass-border); color: #fff; 
        padding: 12px 18px; border-radius: 12px; min-width: 180px;
        font-family: 'Outfit', sans-serif; font-size: 0.95em; outline: none; transition: 0.3s;
        cursor: pointer;
      }
      .cfg-select:hover { border-color: rgba(255,255,255,0.2); }
      .cfg-select:focus { border-color: var(--accent); box-shadow: 0 0 15px var(--accent-glow); }
      
      .info-box-neon { 
        margin-top: 30px; padding: 20px; background: rgba(0, 210, 255, 0.05); 
        border: 1px solid rgba(0, 210, 255, 0.2); border-radius: 18px; 
        display: flex; gap: 15px; align-items: center; color: var(--neon-blue); font-size: 0.9em; line-height: 1.4;
      }

      /* SENSOR CARDS */
      .picker-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }
      .p-card { background: rgba(255,255,255,0.02); border: 1px solid var(--glass-border); border-radius: 20px; padding: 20px; transition: 0.3s; position: relative; z-index: 1; }
      .p-card:hover { background: rgba(255,255,255,0.04); border-color: var(--accent); }
      .p-card:focus-within { z-index: 999; }
      .p-head { font-size: 0.9em; font-weight: 800; margin-bottom: 20px; color: #fff; display: flex; align-items: center; gap: 10px; }
      .u-sel { margin-top: 15px; }
      .u-sel select { width: 100%; background: #000; color: var(--text-dim); border: 1px solid var(--glass-border); padding: 8px; border-radius: 10px; outline: none; font-size: 0.8em; }

      .mega-save-btn { 
        width: 100%; padding: 24px; background: linear-gradient(135deg, var(--accent) 0%, #ff6e00 100%); 
        border: none; border-radius: 20px; color: #fff; font-weight: 800; cursor: pointer; 
        transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1); font-size: 1.25em; letter-spacing: 2px;
        box-shadow: 0 15px 40px rgba(0,0,0,0.6), 0 0 20px var(--accent-glow); margin-top: 40px;
        display: flex; align-items: center; justify-content: center; gap: 15px;
      }
      .mega-save-btn:hover { transform: translateY(-5px); box-shadow: 0 20px 50px rgba(0,0,0,0.7), 0 0 40px var(--accent-glow); }

      .green { color: #2ecc71 !important; }
      .red { color: #e74c3c !important; }

      /* HELP STYLES */
      .help-content { padding: 50px; }
      .help-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; }
      @media (max-width: 900px) {
        .help-grid { grid-template-columns: 1fr; }
        .help-content { padding: 30px; }
      }
      .help-section h4 { color: #fff; font-weight: 800; margin-bottom: 15px; display: flex; align-items: center; gap: 12px; letter-spacing: 1px; }
      .help-section ha-icon { color: var(--accent); }
      .help-section p { color: var(--text-dim); line-height: 1.6; font-size: 0.95em; }
      .help-section ul { padding-left: 20px; color: var(--text-dim); }
      .help-section li { margin-bottom: 10px; font-size: 0.9em; }
      .help-footer { margin-top: 60px; text-align: center; }
      .footer-line { height: 1px; background: linear-gradient(90deg, transparent, var(--glass-border), transparent); margin-bottom: 20px; }
      .help-footer p { font-size: 0.8em; color: var(--text-dim); }

      @media (max-width: 1200px) {
        .dashboard-layout { grid-template-columns: 1fr; }
        .sidebar { order: 2; }
      }
      
      @media (max-width: 600px) {
        .main-card { padding: 25px; }
        .labels-top .val { font-size: 1.8em; }
        .labels-top .box { padding: 10px 15px; }
        .node { width: 50px; height: 50px; font-size: 1.25em; border-radius: 12px; }
        .pth-active { stroke-width: 4; }
      }
    `;
  }
}
customElements.define("hoymiles-cyd-panel", HoymilesCYDPanel);
