import {
  LitElement,
  html,
  css,
  svg
} from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

// Custom Entity Picker inherited from Kairo style
class HoymilesEntityPicker extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      label: { type: String },
      value: { type: String },
      open: { type: Boolean, reflect: true },
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
      label { display: block; font-size: 0.75em; color: var(--text-dim); margin-bottom: 8px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
      .input-box { 
        background: rgba(0, 0, 0, 0.4); 
        border: 1px solid var(--kairo-glass-border); 
        padding: 12px 18px; 
        border-radius: 12px; 
        cursor: pointer; 
        display: flex; 
        justify-content: space-between; 
        align-items: center;
        transition: 0.3s;
        color: #fff;
      }
      .picker-icons { display: flex; align-items: center; gap: 8px; }
      .picker-icons ha-icon { --mdc-icon-size: 18px; color: var(--text-dim); }
      .picker-icons ha-icon:hover { color: var(--kairo-gold); }
      .input-box:hover { border-color: var(--kairo-gold); background: rgba(255,255,255,0.03); }
      .placeholder { color: #555; }
      .dropdown { 
        position: absolute; top: 100%; left: 0; right: 0; z-index: 9999; 
        margin-top: 8px; max-height: 300px; display: flex; flex-direction: column;
        border: 1px solid var(--kairo-gold); border-radius: 12px; overflow: hidden;
        box-shadow: 0 15px 50px rgba(0,0,0,0.8);
      }
      .glass-dark { background: #0c0c0e; backdrop-filter: blur(20px); }
      .search-wrap { display: flex; align-items: center; background: #000; padding: 0 10px; border-bottom: 1px solid rgba(255,255,255,0.05); }
      input { 
        background: transparent; border: none; 
        padding: 12px; color: #fff; width: 100%; box-sizing: border-box; outline: none;
        font-family: inherit;
      }
      .list { overflow-y: auto; flex: 1; }
      .item { padding: 12px 15px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.03); display: flex; flex-direction: column; gap: 4px; }
      .item .name { font-size: 0.9em; font-weight: bold; color: #fff; }
      .item .id { font-size: 0.75em; color: #8b949e; font-family: 'JetBrains Mono', monospace; word-break: break-all; }
      .item:hover { background: rgba(247, 147, 26, 0.1); }
      .item.selected { border-left: 3px solid var(--kairo-gold); background: rgba(247, 147, 26, 0.1); }
      .empty { padding: 20px; text-align: center; color: var(--text-dim); }
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
      _historyData: { type: Object },
      _availableInverters: { type: Array },
      _latestVersion: { type: String },
      _currentVersion: { type: String },
      _connectedDisplays: { type: Object },
      _isUpdating: { type: Boolean },
      _updateStatus: { type: String },
      _sunPos: { type: Number },
      _moonPos: { type: Number },
      _isNight: { type: Boolean },
      _time: { type: String },
      _decisionLog: { type: Array },
      _savedWh: { type: Number },
      _expertMode: { type: Boolean },
      activeSubTab: { type: String }
    };
  }

  constructor() {
    super();
    this.activeTab = 'dashboard';
    this.activeSubTab = 'general';
    this._latestVersion = '';
    this._currentVersion = '';
    this._connectedDisplays = {};
    this._isUpdating = false;
    this._updateStatus = '';
    this._sunPos = 0;
    this._moonPos = 0;
    this._isNight = false;
    this._time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    this._decisionLog = [];
    this._savedWh = 0;
    this._expertMode = false;
    this.config = {
      grid_sensor: '',
      grid_energy_import_sensor: '',
      grid_energy_export_sensor: '',
      solar_power_sensor: '',
      solar_energy_yield_sensor: '',
      battery_soc_sensor: '',
      battery_power_sensor: '',
      target_grid_watt: 10,
      manual_limit_value: 50,
      manual_limit_type: 'percent',
      max_capacity: 800,
      min_limit: 10,
      max_limit: 100,
      operation_mode: 'zero_export',
      selected_inverter: 'all',
      external_limit_entity: '',
      inverter_type: 'hoymiles',
      generic_limit_type: 'watt',
      zero_export_hysteresis: 5,
      zero_export_interval: 10,
      electricity_price: 30.0,
      sub_consumer_1_name: '', sub_consumer_1_sensor: '', sub_consumer_1_icon: 'mdi:power-plug', sub_consumer_1_toggle: '', sub_consumer_1_use_as_load: false,
      sub_consumer_2_name: '', sub_consumer_2_sensor: '', sub_consumer_2_icon: 'mdi:power-plug', sub_consumer_2_toggle: '', sub_consumer_2_use_as_load: false,
      sub_consumer_3_name: '', sub_consumer_3_sensor: '', sub_consumer_3_icon: 'mdi:power-plug', sub_consumer_3_toggle: '', sub_consumer_3_use_as_load: false,
      sub_consumer_4_name: '', sub_consumer_4_sensor: '', sub_consumer_4_icon: 'mdi:power-plug', sub_consumer_4_toggle: '', sub_consumer_4_use_as_load: false
    };
    this._historyData = { grid: [], solar: [], battery: [] };
    this._configLoaded = false;
    this._availableInverters = [];
    this._updateEventUnsub = null;
    this._historyInterval = null;
    this._timeInterval = null;
  }

  connectedCallback() {
    super.connectedCallback();
    if (this.hass) {
      this._initialize();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (typeof this._updateEventUnsub === 'function') {
      this._updateEventUnsub();
      this._updateEventUnsub = null;
    } else if (this._updateEventUnsub instanceof Promise) {
      this._updateEventUnsub.then(unsub => {
        if (typeof unsub === 'function') unsub();
      });
      this._updateEventUnsub = null;
    }
    if (this._historyInterval) {
      clearInterval(this._historyInterval);
      this._historyInterval = null;
    }
    if (this._timeInterval) {
      clearInterval(this._timeInterval);
      this._timeInterval = null;
    }
  }

  async _initialize() {
    if (this._configLoaded) return;
    await this._loadConfig();
    await this._loadInverters();
    this._configLoaded = true;
    if (this._historyInterval) clearInterval(this._historyInterval);
    this._historyInterval = setInterval(() => {
      this._fetchHistory();
      this._fetchLog();
    }, 60000);

    this._timeInterval = setInterval(() => {
      this._time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }, 30000);

    this._fetchHistory();
    this._fetchLog();
    this._fetchDisplays();
    setInterval(() => this._fetchDisplays(), 10000);
    setInterval(() => this._fetchHistory(), 60000);
    setInterval(() => this._fetchLog(), 30000);

    if (this.hass.connection && !this._updateEventUnsub) {
      this._updateEventUnsub = this.hass.connection.subscribeEvents((event) => {
        this._isUpdating = false;
        this._updateStatus = event.data.status === 'success' ? 'Update erfolgreich! Bitte HA neu starten.' : 'Fehler: ' + event.data.message;
        this.requestUpdate();
      }, 'hoymiles_cyd_update_completed');
    }
    this._updateSunPos();
    this._checkUpdate();
  }

  _updateSunPos() {
    const sun = this.hass.states['sun.sun'];
    if (!sun) return;
    
    try {
      const now = new Date();
      const elevation = sun.attributes.elevation || 0;
      const next_setting = new Date(sun.attributes.next_setting);
      const next_rising = new Date(sun.attributes.next_rising);
      
      // Accuracy: it's night if next rising is sooner than next setting
      this._isNight = next_rising < next_setting;
      
      if (!this._isNight) {
        // Day: Use elevation for a nice arc, or time-based
        // Let's use time-based for consistency with the clock
        const totalDay = 14 * 3600000; // Assume 14h day length for the arc
        const elapsed = next_setting.getTime() - now.getTime();
        this._sunPos = 1 - Math.min(1, Math.max(0, elapsed / totalDay));
        this._moonPos = -1;
      } else {
        // Night
        const totalNight = 10 * 3600000;
        const elapsed = next_rising.getTime() - now.getTime();
        this._moonPos = 1 - Math.min(1, Math.max(0, elapsed / totalNight));
        this._sunPos = -1;
      }
    } catch (e) {
      console.error("Sun position error:", e);
    }
  }

  shouldUpdate(changedProps) {
    if (changedProps.size > 1 || !changedProps.has('hass')) return true;
    const oldHass = changedProps.get('hass');
    if (!oldHass || !this.hass) return true;

    const monitorEntities = [
      this.config.solar_power_sensor, this.config.grid_sensor,
      this.config.battery_power_sensor, this.config.battery_soc_sensor,
      this.config.solar_energy_yield_sensor, this.config.grid_energy_import_sensor,
      this.config.grid_energy_export_sensor,
      'sensor.zero_export_controller_nulleinspeisung_status',
      'sensor.zero_export_controller_zero_export_status'
    ];
    
    if (this.config.enable_sub_consumers) {
      for (let i = 1; i <= 4; i++) {
        monitorEntities.push(this.config[`sub_consumer_${i}_sensor`]);
        monitorEntities.push(this.config[`sub_consumer_${i}_toggle`]);
      }
    }

    for (const entityId of monitorEntities) {
      if (entityId && this.hass.states[entityId] !== oldHass.states[entityId]) return true;
    }
    return changedProps.has('activeTab') || changedProps.has('_isUpdating') || changedProps.has('_updateStatus') || changedProps.has('_time');
  }

  async _checkUpdate() {
    try {
      const syncResp = await this.hass.callApi('GET', 'hoymiles_cyd_sync');
      this._currentVersion = syncResp.version || 'v1.1.2';
      const gitResp = await fetch('https://raw.githubusercontent.com/low-streaming/hoymiles_cyd/main/custom_components/hoymiles_cyd/manifest.json');
      const gitManifest = await gitResp.json();
      this._latestVersion = gitManifest.version;
    } catch (e) { console.error("Update check failed", e); }
  }

  async _fetchLog() {
    try {
      const data = await this.hass.callApi('GET', 'hoymiles_cyd_sync');
      if (data) {
        this._decisionLog = data.log || data.history || [];
        this._savedWh = data.saved_wh || data.energy_saved || 0;
      }
    } catch (e) { console.error("Error fetching log", e); }
  }

  async _fetchDisplays() {
    try {
      const resp = await this.hass.callApi('GET', 'hoymiles_cyd_displays');
      this._connectedDisplays = resp.displays || {};
    } catch (e) { console.error("Failed to fetch displays", e); }
  }

  async _runUpdate() {
    if (!confirm("Möchtest du das Update jetzt installieren?")) return;
    this._isUpdating = true;
    this._updateStatus = 'Downloading & Installing...';
    try { await this.hass.callService('hoymiles_cyd', 'update_integration', {}); } catch (e) { 
      this._isUpdating = false; 
      this._updateStatus = 'Fehler beim Update.';
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
    } catch (e) { }
  }

  async _fetchHistory() {
    if (!this.hass || !this.config) return;
    try {
      const now = new Date();
      const startTime = new Date(now.getTime() - 3600000);
      const sensors = [this.config.grid_sensor, this.config.solar_power_sensor, this.config.battery_power_sensor].filter(Boolean);
      if (sensors.length === 0) return;

      const url = `history/period/${startTime.toISOString()}?filter_entity_id=${sensors.join(',')}&end_time=${now.toISOString()}`;
      const result = await this.hass.callApi('GET', url);
      
      const historyObj = { grid: [], solar: [], battery: [] };
      if (result && Array.isArray(result)) {
        result.forEach(entityHistory => {
          if (entityHistory && entityHistory.length > 0) {
            const entId = entityHistory[0].entity_id;
            if (entId === this.config.grid_sensor) historyObj.grid = entityHistory;
            else if (entId === this.config.solar_power_sensor) historyObj.solar = entityHistory;
            else if (entId === this.config.battery_power_sensor) historyObj.battery = entityHistory;
          }
        });
      }
      this._historyData = historyObj;
      console.log("Mapped History:", historyObj);
      this.requestUpdate();
    } catch (e) {
      console.error("History fetch error:", e);
    }
  }

  async _saveConfig() {
    try {
      await this.hass.callApi('POST', 'hoymiles_cyd_config', this.config);
      this.dispatchEvent(new CustomEvent('hass-notification', { detail: { message: "Einstellungen erfolgreich gespeichert!", duration: 3000 }, bubbles: true, composed: true }));
    } catch (e) { alert("Speichern fehlgeschlagen"); }
  }

  render() {
    const zero_status = (this.hass.states['sensor.zero_export_controller_nulleinspeisung_status'] || this.hass.states['sensor.zero_export_controller_zero_export_status'])?.state || '--';
    return html`
      <div class="panel-container">
        <div class="cyber-grid"></div>
        <div class="header">
          <div class="back-btn" @click="${() => window.history.length > 1 ? history.back() : (window.location.href = '/')}">
            <ha-icon icon="mdi:arrow-left"></ha-icon>
          </div>
          <div class="logo-area">
            <div class="logo-icon-kairo">
               <svg viewBox="0 0 100 100" class="k-logo">
                  <path d="M20 20 L20 80 M20 50 L60 20 M20 50 L60 80" stroke="var(--kairo-cyan)" stroke-width="12" stroke-linecap="round" fill="none"/>
                  <circle cx="70" cy="50" r="10" fill="var(--kairo-gold)"/>
               </svg>
            </div>
            <div class="logo-text">
              <h1>OPENKAIRO <span style="color: var(--kairo-cyan); opacity: 0.8;">PRO</span></h1>
              <div class="status-badge">
                <span class="status-dot ${zero_status.includes('Läuft') ? 'active' : ''}"></span>
                <span class="status-text">${zero_status.toUpperCase()}</span>
              </div>
            </div>
          </div>
          <div class="global-zen-wrap ${this.config.is_enabled ? 'active' : ''}">
             <div class="gz-icon"><ha-icon icon="mdi:power-standby"></ha-icon></div>
             <div class="gz-text">
               <div class="gz-title">ZEN-MODUS</div>
               <div class="gz-status">${this.config.is_enabled ? 'AKTIV' : 'AUS'}</div>
             </div>
             <ha-switch .checked="${this.config.is_enabled || false}"
               @change="${(e) => { this.config.is_enabled = e.target.checked; this._handleSwitchChange(e.target.checked); this.requestUpdate(); }}"></ha-switch>
          </div>
          <div class="time-area">
            <ha-icon icon="mdi:clock-outline" style="margin-right: 8px; color: var(--kairo-cyan);"></ha-icon>
            ${this._time} | ${new Date().toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit' }).toUpperCase()}
          </div>
        </div>

        <div class="main-nav glass">
          <div class="nav-item ${this.activeTab === 'dashboard' ? 'active' : ''}" @click="${() => this.activeTab = 'dashboard'}">
            <ha-icon icon="mdi:view-dashboard-outline"></ha-icon> DASHBOARD
          </div>
          <div class="nav-item ${this.activeTab === 'analyse' ? 'active' : ''}" @click="${() => this.activeTab = 'analyse'}">
            <ha-icon icon="mdi:chart-timeline-variant"></ha-icon> ANALYSE
          </div>
          <div class="nav-item ${this.activeTab === 'settings' ? 'active' : ''}" @click="${() => this.activeTab = 'settings'}">
            <ha-icon icon="mdi:cog-outline"></ha-icon> SETUP
          </div>
          <div class="nav-item ${this.activeTab === 'display' ? 'active' : ''}" @click="${() => this.activeTab = 'display'}">
            <ha-icon icon="mdi:monitor-dashboard"></ha-icon> DISPLAYS
          </div>
          <div class="nav-item ${this.activeTab === 'help' ? 'active' : ''}" @click="${() => this.activeTab = 'help'}">
            <ha-icon icon="mdi:help-circle-outline"></ha-icon> HILFE
          </div>
        </div>

        <div class="main-content">
          ${this.activeTab === 'dashboard' ? this.renderDashboard() :
            this.activeTab === 'analyse' ? this.renderAnalyse() :
            this.activeTab === 'settings' ? this.renderSettings() :
            this.activeTab === 'display' ? this.renderDisplayUpdate() :
            this.renderHelp()}
        </div>
      </div>
    `;
  }

  renderDashboard() {
    const getVal = (id, scale) => {
      if (!id || !this.hass.states[id]) return 0;
      const s = this.hass.states[id];
      if (s.state === 'unavailable' || s.state === 'unknown') return 0;
      let v = parseFloat(s.state) || 0;
      return scale === 'kw_to_w' ? v * 1000 : (scale === 'w_to_kw' ? v / 1000 : v);
    };

    // Current Power (Watts)
    const solar_p = getVal(this.config.solar_power_sensor || 'sensor.hoymiles_cyd_ac_power', this.config.solar_power_scale);
    let batt_p = getVal(this.config.battery_power_sensor, this.config.battery_power_scale);
    if (this.config.battery_power_invert) batt_p *= -1;

    let grid_p = 0;
    let house_p = 0;

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
      house_p = bl_power;
      grid_p = house_p - solar_p + batt_p;
    } else {
      const raw_grid_p = getVal(this.config.grid_sensor, this.config.grid_power_scale);
      if (this.config.grid_sensor_type === 'consumption') {
        house_p = raw_grid_p;
        grid_p = Math.round(house_p + (batt_p || 0) - solar_p, 0);
      } else {
        grid_p = raw_grid_p;
        house_p = Math.max(0, solar_p + grid_p - (batt_p || 0));
      }
    }

    const yield_t = getVal(this.config.solar_energy_yield_sensor || 'sensor.hoymiles_cyd_today_yield', this.config.solar_yield_scale);
    const import_t = getVal(this.config.grid_energy_import_sensor, this.config.grid_import_scale);
    const export_t = getVal(this.config.grid_energy_export_sensor, this.config.grid_export_scale);
    const soc = parseFloat(this.hass.states[this.config.battery_soc_sensor]?.state) || 0;

    const limit_ent = this.hass.states['sensor.zero_export_controller_nulleinspeisung_leistungslimit'] || this.hass.states['sensor.zero_export_controller_zero_export_limit'];
    const control_limit = limit_ent?.state === 'unknown' || limit_ent?.state === 'unavailable' ? '--' : (limit_ent?.state || '--');
    const limit_unit = limit_ent?.attributes?.unit_of_measurement || '%';

    return html`
      <div class="dashboard-layout animate-fade-in">
        <div class="main-card glass">
          <div class="summary-grid">
            <div class="sum-card"><span class="sum-label">SOLAR HEUTE</span><span class="sum-value">${yield_t.toFixed(2)}<span class="sum-unit">kWh</span></span></div>
            <div class="sum-card"><span class="sum-label">NETZ BEZUG</span><span class="sum-value">${import_t.toFixed(2)}<span class="sum-unit">kWh</span></span></div>
            <div class="sum-card"><span class="sum-label">NETZ EINSPEISUNG</span><span class="sum-value">${export_t.toFixed(2)}<span class="sum-unit">kWh</span></span></div>
            <div class="sum-card"><span class="sum-label">HAUS GESAMT</span><span class="sum-value">${Math.max(0, yield_t + import_t - export_t).toFixed(2)}<span class="sum-unit">kWh</span></span></div>
          </div>

          <div class="visualizer">
            ${this._renderSunArc(solar_p)}
            <div class="engine">
              <svg class="engine-svg" viewBox="0 0 600 420">
                <path d="M 120 100 Q 300 100 300 210" class="pth" />
                <path d="M 300 210 Q 300 100 480 100" class="pth" />
                <path d="M 120 320 Q 300 320 300 210" class="pth" />
                <path d="M 300 210 Q 300 320 480 320" class="pth" />
              </svg>
              <div class="particle-layer">
                 ${(() => {
                   const now = new Date();
                   const sun = this.hass.states['sun.sun'];
                   const isNight = sun?.state === 'below_horizon';
                   const t = this._sunPos;
                   if (solar_p <= 10 || isNight) return '';
                   const sx = (1-t)**2 * 35 + 2*(1-t)*t * 260 + t**2 * 485;
                   const sy = ((1-t)**2 * 78 + 2*(1-t)*t * (-45) + t**2 * 78) - 100;
                   const adjX = (sx / 520) * 600;
                   const path = `M ${adjX} ${sy} Q ${adjX} 50 120 100`;
                   return this._renderCSSFlow(path, solar_p, 'var(--kairo-gold)', true);
                 })()}
                 ${solar_p > 10 ? this._renderCSSFlow('M 120 100 Q 300 100 300 210', solar_p, 'var(--kairo-gold)') : ''}
                 ${house_p > 10 ? this._renderCSSFlow('M 300 210 Q 300 100 480 100', house_p, 'var(--kairo-cyan)') : ''}
                 ${grid_p > 10 ? this._renderCSSFlow('M 120 320 Q 300 320 300 210', grid_p, 'var(--kairo-pink)') : ''}
                 ${grid_p < -10 ? this._renderCSSFlow('M 300 210 Q 300 320 120 320', Math.abs(grid_p), 'var(--kairo-cyan)') : ''}
                 ${Math.abs(batt_p) > 5 ? this._renderCSSFlow(batt_p > 0 ? 'M 300 210 Q 300 320 480 320' : 'M 480 320 Q 300 320 300 210', Math.abs(batt_p), 'var(--kairo-green)') : ''}
              </div>
              <div class="inverter-hub ${grid_p > 20 ? 'import' : grid_p < -20 ? 'export' : 'balanced'}">
                <span class="hub-label">NETZ-BILANZ</span>
                <span class="hub-value">${Math.abs(grid_p).toFixed(0)}<span class="hub-unit">W</span></span>
                <span class="hub-status">LIMIT: ${control_limit}${control_limit !== '--' ? limit_unit : ''}</span>
              </div>
              
              <div class="node n-solar" style="top: 23.8%; left: 20%;">
                <ha-icon icon="mdi:solar-power-variant"></ha-icon>
                <div class="power-tag" style="background: var(--kairo-gold);">${solar_p.toFixed(0)}W</div>
              </div>
              <div class="node n-house" style="top: 23.8%; left: 80%;">
                <ha-icon icon="mdi:home-lightning-bolt-outline"></ha-icon>
                <div class="power-tag" style="background: var(--kairo-cyan);">${house_p.toFixed(0)}W</div>
              </div>
              <div class="node n-grid" style="top: 76.2%; left: 20%;">
                <ha-icon icon="mdi:transmission-tower"></ha-icon>
                <div class="power-tag" style="background: ${grid_p > 0 ? 'var(--kairo-pink)' : 'var(--kairo-cyan)'};">${grid_p.toFixed(0)}W</div>
              </div>
              <div class="node n-batt" style="top: 76.2%; left: 80%;">
                <ha-icon icon="mdi:battery-charging"></ha-icon>
                <div class="soc-tag">${soc.toFixed(0)}%</div>
                <div class="power-tag" style="background: var(--kairo-green);">${batt_p.toFixed(0)}W</div>
              </div>

              ${this.config.enable_sub_consumers ? html`
              <div class="sub-consumers-wrap">
                ${[1, 2, 3, 4].map(i => {
                  const s = this.config[`sub_consumer_${i}_sensor`];
                  const n = this.config[`sub_consumer_${i}_name`];
                  if (!n && !s) return '';
                  const p_w = getVal(s, this.config[`sub_consumer_${i}_scale`]);
                  const t = this.config[`sub_consumer_${i}_toggle`];
                  const icon = this.config[`sub_consumer_${i}_icon`] || 'mdi:power-plug';
                  const on = t ? this.hass.states[t]?.state === 'on' : p_w > 5;
                  return html`
                    <div class="sub-node ${on ? 'on' : ''}" @click="${() => t && this._toggleSwitch(t)}">
                      <div class="s-lab">${n}</div>
                      <ha-icon icon="${icon}"></ha-icon>
                      <div class="s-val">${p_w.toFixed(0)}W</div>
                    </div>
                  `;
                })}
              </div>
              ` : ''}
            </div>
          </div>
        </div>

        <div class="sidebar">
          <div class="side-card glass">
            <div class="s-cap">SYSTEMSTATUS</div>
            <div class="s-flex">
              <div class="s-icon orange"><ha-icon icon="mdi:shield-check-outline"></ha-icon></div>
              <div class="s-vals">
                <div class="s-row"><span>Status</span> <span class="green">AKTIV</span></div>
                <div class="s-row"><span>Version</span> <span>${this._currentVersion}</span></div>
              </div>
            </div>
          </div>
          <div class="side-card glass">
            <div class="s-cap">BILANZ HEUTE</div>
            <div class="s-flex">
              <div class="s-icon"><ha-icon icon="mdi:finance"></ha-icon></div>
              <div class="s-vals">
                <div class="s-row">
                  <span>Autarkie</span> 
                  <span class="green">
                    ${(() => {
                      const consumed = Math.max(0, yield_t - export_t);
                      const cons_tot = yield_t + import_t - export_t;
                      return cons_tot > 0.1 ? Math.min(100, (consumed / cons_tot) * 100).toFixed(1) : '0.0';
                    })()}%
                  </span>
                </div>
                <div class="s-row">
                  <span>Eigenverbrauch</span> 
                  <span class="green">
                    ${(() => {
                      const consumed = Math.max(0, yield_t - export_t);
                      return yield_t > 0.1 ? Math.min(100, (consumed / yield_t) * 100).toFixed(1) : '0.0';
                    })()}%
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div class="side-card glass" style="border-color: var(--kairo-gold);">
            <div class="s-cap">ERSPARNIS</div>
            <div class="s-flex">
              <div class="s-icon" style="color: var(--kairo-gold);"><ha-icon icon="mdi:piggy-bank-outline"></ha-icon></div>
              <div class="s-vals">
                ${(() => {
                  const price_ct = this.config.electricity_price || 30.0;
                  const price_euro = price_ct / 100.0;
                  const saved_today = Math.max(0, yield_t - export_t);
                  const saved_today_val = saved_today * price_euro;
                  const saved_zen = this._savedWh / 1000.0;
                  const saved_zen_val = saved_zen * price_euro;
                  return html`
                    <div class="s-row"><span>Heute (Eigen)</span> <span style="color: var(--kairo-gold); font-weight: 800;">${saved_today.toFixed(2)} kWh</span></div>
                    <div class="s-row"><span>Wert Heute</span> <span style="color: #fff;">${saved_today_val.toFixed(2)} €</span></div>
                    <div class="s-row" style="margin-top: 10px; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 10px; font-size: 0.85em;"><span>ZEN Gesamt</span> <span>${saved_zen.toFixed(1)} kWh</span></div>
                    <div class="s-row" style="font-size: 0.85em;"><span>Wert Gesamt</span> <span>${saved_zen_val.toFixed(2)} €</span></div>
                  `;
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _renderSunArc(solar_p) {
    const isNight = this._isNight;
    const t = isNight ? this._moonPos : this._sunPos;
    const x = (1-t)**2 * 35 + 2*(1-t)*t * 260 + t**2 * 485;
    const y = (1-t)**2 * 78 + 2*(1-t)*t * (-45) + t**2 * 78;

    const sun = this.hass.states['sun.sun'];
    let rise = '--:--';
    let set = '--:--';
    if (sun && sun.attributes) {
      const dRise = new Date(sun.attributes.next_rising);
      const dSet = new Date(sun.attributes.next_setting);
      rise = dRise.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      set = dSet.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    const intensity = Math.min(1, solar_p / 1000);
    const glowColor = isNight ? 'var(--kairo-cyan)' : '#ff9d00';
    const glowR = isNight ? 20 : 15 + (intensity * 25);
    const glowO = isNight ? 0.2 : 0.15 + (intensity * 0.4);

    return html`
      <div class="sun-arc-wrap ${isNight ? 'night' : ''}">
        <svg viewBox="0 0 520 100" style="overflow:visible;">
          <path d="M 35,78 Q 260,-45 485,78" class="sun-arc-path ${isNight ? 'moon-arc' : ''}" />
          
          <text x="35" y="65" text-anchor="middle" class="arc-time-label">${rise}</text>
          <text x="260" y="-15" text-anchor="middle" class="arc-time-label" style="opacity: 1; fill: ${isNight ? 'var(--kairo-cyan)' : 'var(--kairo-gold)'};">${isNight ? '00:00' : '12:00'}</text>
          <text x="485" y="65" text-anchor="middle" class="arc-time-label">${set}</text>

          <g style="transform: translate(${x}px, ${y}px)">
            <circle r="${glowR}" fill="${glowColor}" style="opacity: ${glowO}; filter: blur(8px);" />
            <circle r="${glowR * 0.6}" fill="${glowColor}" style="opacity: ${glowO * 1.5};" />
            
            ${isNight ? html`
              <path d="M -6,-6 A 8,8 0 1,1 -6,10 A 6,6 0 1,0 -6,-6" fill="var(--kairo-cyan)" style="filter: drop-shadow(0 0 10px var(--kairo-cyan)); transform: rotate(-20deg);" />
            ` : html`
              <circle r="7" fill="#ff9d00" class="sun-icon" style="filter: drop-shadow(0 0 ${12 + intensity*20}px #ff9d00);" />
            `}
            
            ${!isNight && solar_p > 10 ? html`
            <g style="transform: translate(12px, -15px)">
               <rect width="60" height="20" rx="10" fill="rgba(0,0,0,0.9)" stroke="rgba(247, 147, 26, 0.8)" stroke-width="1.5" />
               <text x="30" y="14" text-anchor="middle" style="fill: #fff; font-size: 9px; font-weight: 900; font-family: 'JetBrains Mono';">
                 ${(solar_p / 1000).toFixed(2)}kW⚡
               </text>
            </g>
            ` : ''}

            <text x="0" y="24" text-anchor="middle" style="fill: ${isNight ? 'var(--kairo-cyan)' : 'var(--kairo-gold)'}; font-size: 11px; font-weight: 900; font-family: 'JetBrains Mono'; text-shadow: 0 0 8px rgba(0,0,0,1);">
              ${this._time}
            </text>
          </g>
        </svg>
      </div>
    `;
  }

  _renderCSSFlow(path, power, color, isSunFlow = false) {
    const intensity = Math.min(1, power / 1000);
    const dur = Math.max(0.8, 6 - (Math.log10(power + 1) * 1.5));
    const count = Math.min(15, Math.max(2, Math.ceil(power / 40)));
    const size = isSunFlow ? (6 + intensity * 8) : 6;
    const glow = isSunFlow ? (10 + intensity * 20) : 10;
    
    return html`
      <div class="flow-group">
        ${Array.from({length: count}).map((_, i) => html`
          <div class="flow-particle" 
            style="offset-path: path('${path}'); 
                   background: ${color}; 
                   width: ${size}px; height: ${size}px;
                   box-shadow: 0 0 ${glow}px ${color}; 
                   animation: flow ${dur}s linear infinite; 
                   animation-delay: -${(i*(dur/count)).toFixed(2)}s;">
          </div>`)}
      </div>`;
  }

  _generateStackedPaths() {
    const w = 500, h = 120, points = 50;
    const now = new Date().getTime();
    const startTime = now - 3600000;
    const getValAt = (h, t) => {
      if (!h || h.length === 0) return 0;
      const entry = h.slice().reverse().find(e => {
        const ts = e.lu || e.last_updated || e.last_changed;
        const date = isNaN(ts) ? new Date(ts) : new Date(ts * 1000);
        return date.getTime() <= t;
      });
      return entry ? parseFloat(entry.s || entry.state) || 0 : (parseFloat(h[0].s || h[0].state) || 0);
    };
    const solarData = [], battData = [], gridData = [];
    if (!this._historyData || !this._historyData.solar) return { p1: "M 0,120 L 500,120", p2: "M 0,120 L 500,120", p3: "M 0,120 L 500,120" };
    
    for (let i = 0; i < points; i++) {
      const t = startTime + (i / (points - 1)) * 3600000;
      solarData.push(Math.max(0, getValAt(this._historyData.solar, t)));
      let b = getValAt(this._historyData.battery, t); if (this.config.battery_power_invert) b *= -1;
      battData.push(Math.abs(b));
      gridData.push(Math.max(0, getValAt(this._historyData.grid, t)));
    }
    let maxValues = solarData.map((s, i) => s + battData[i] + gridData[i]);
    let maxT = Math.max(...maxValues, 100); 
    const scale = h / maxT;
    const createP = (d, off = null) => {
      let pts = d.map((v, i) => `${(i/(points-1))*w},${h - (v + (off?off[i]:0))*scale}`);
      let p = `M ${pts[0]}`; pts.forEach(pt => p += ` L ${pt}`);
      if (off) { 
        let rev = off.map((v, i) => `${(i/(points-1))*w},${h - v*scale}`).reverse();
        rev.forEach(pt => p += ` L ${pt}`);
      } else { p += ` L ${w},${h} L 0,${h}`; }
      return p + " Z";
    };
    const paths = { p1: createP(solarData), p2: createP(battData, solarData), p3: createP(gridData, solarData.map((s, i) => s + battData[i])) };
    console.log("DEBUG CHART:", {
      solarData: solarData.slice(0,5),
      battData: battData.slice(0,5),
      gridData: gridData.slice(0,5),
      maxT,
      scale,
      p1Start: paths.p1.substring(0, 40)
    });
    return paths;
  }

  renderAnalyse() {
    return html`
      <div class="settings-page animate-fade-in">
        <div class="setup-header">
           <div class="setup-title">ANALYSE & PERFORMANCE</div>
        </div>
        <div class="config-grid">
           <div class="config-section glass" style="grid-column: span 2;">
               <div class="section-title"><ha-icon icon="mdi:chart-bell-curve-cumulative"></ha-icon> ENERGIE-BILANZ (1H)</div>
               <div class="canvas" style="height: 200px; margin-top: 20px;">
                  <svg viewBox="0 0 500 120" preserveAspectRatio="none" style="height: 100%; width: 100%; overflow: visible;">
                     <defs>
                       <linearGradient id="gradS" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="0%" stop-color="rgba(247, 147, 26, 0.5)"/>
                         <stop offset="100%" stop-color="rgba(247, 147, 26, 0.05)"/>
                       </linearGradient>
                       <linearGradient id="gradB" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="0%" stop-color="rgba(46, 204, 113, 0.5)"/>
                         <stop offset="100%" stop-color="rgba(46, 204, 113, 0.05)"/>
                       </linearGradient>
                       <linearGradient id="gradG" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="0%" stop-color="rgba(255, 0, 127, 0.5)"/>
                         <stop offset="100%" stop-color="rgba(255, 0, 127, 0.05)"/>
                       </linearGradient>
                     </defs>
                     <rect x="0" y="0" width="500" height="120" fill="rgba(255,255,255,0.02)" />
                     <path d="M 0,30 L 500,30 M 0,60 L 500,60 M 0,90 L 500,90" stroke="rgba(255,255,255,0.05)" stroke-width="1" stroke-dasharray="3,3" fill="none" />
                      ${(() => {
                        const { p1, p2, p3 } = this._generateStackedPaths();
                        return svg`
                          <path d="${p3}" fill="url(#gradG)" stroke="#ff007f" stroke-width="1.5" stroke-linejoin="round" />
                          <path d="${p2}" fill="url(#gradB)" stroke="#2ecc71" stroke-width="1.5" stroke-linejoin="round" />
                          <path d="${p1}" fill="url(#gradS)" stroke="#F7931A" stroke-width="1.5" stroke-linejoin="round" />
                        `;
                      })()}
                   </svg>
               </div>
               <div class="flow-legend" style="border:none; background:transparent;">
                  <div class="leg-item"><div class="dot neon-orange-bg"></div> SOLAR</div>
                  <div class="leg-item"><div class="dot neon-green-bg"></div> BATTERIE</div>
                  <div class="leg-item"><div class="dot neon-pink-bg"></div> NETZ</div>
               </div>
           </div>
           <div class="config-section glass">
              <div class="section-title"><ha-icon icon="mdi:clipboard-pulse-outline"></ha-icon> REGLER-LOG</div>
              <div style="background:rgba(0,0,0,0.3); padding:15px; border-radius:12px; font-family:monospace; font-size:0.8em; max-height:250px; overflow-y:auto;">
                 ${this._decisionLog.map(l => html`<div style="margin-bottom:5px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:3px;">${l}</div>`)}
              </div>
           </div>
        </div>
      </div>
    `;
  }

  renderSettings() {
    return html`
      <div class="settings-page animate-fade-in">
        <div class="setup-header">
           <div class="setup-header-inner">
              <div>
                <div class="setup-title">S_SETUP: KONFIGURATION</div>
                <div class="setup-step">Schritt-für-Schritt Einrichtung für optimale Nulleinspeisung.</div>
              </div>
              <div class="glass expert-badge">
                 <span style="font-size: 0.8em; font-weight: bold; color: var(--text-dim); letter-spacing: 1px;">EXPERTEN-MODUS</span>
                 <ha-switch .checked="${this._expertMode}" @change="${(e) => { this._expertMode = e.target.checked; this.requestUpdate(); }}"></ha-switch>
              </div>
           </div>
        </div>

        <div class="sub-nav">
           <div class="sub-item ${this.activeSubTab === 'general' ? 'active' : ''}" @click="${() => this.activeSubTab = 'general'}">Allgemein</div>
           <div class="sub-item ${this.activeSubTab === 'sensors' ? 'active' : ''}" @click="${() => this.activeSubTab = 'sensors'}">Sensoren</div>
           <div class="sub-item ${this.activeSubTab === 'algorithm' ? 'active' : ''}" @click="${() => this.activeSubTab = 'algorithm'}">Regelung</div>
           <div class="sub-item ${this.activeSubTab === 'safety' ? 'active' : ''}" @click="${() => this.activeSubTab = 'safety'}">Schutz</div>
           <div class="sub-item ${this.activeSubTab === 'devices' ? 'active' : ''}" @click="${() => this.activeSubTab = 'devices'}">Geräte</div>
        </div>

        <div class="config-grid">
          ${this.activeSubTab === 'general' ? html`
            <div class="config-section glass animate-fade-in" style="grid-column: span 2;">
               <div class="section-title"><ha-icon icon="mdi:tune-vertical"></ha-icon> STEUERUNG & HARDWARE</div>
               
               <div class="cfg-row">
                  <div class="cfg-info">
                     <div class="cfg-label">ZEN-Automatisierung</div>
                     <div class="cfg-desc">Nulleinspeisung ein- oder ausschalten.</div>
                  </div>
                  <ha-switch .checked="${this.config.is_enabled || false}"
                    @change="${(e) => { this.config.is_enabled = e.target.checked; this._handleSwitchChange(e.target.checked); }}"></ha-switch>
               </div>
               
               <div class="cfg-row">
                  <div class="cfg-info">
                     <div class="cfg-label">Hardware-System</div>
                     <div class="cfg-desc">Welches Gerät wird gesteuert?</div>
                  </div>
                  <select class="cfg-num" style="width:220px;" .value="${this.config.inverter_type || 'hoymiles'}"
                    @change="${(e) => this.config.inverter_type = e.target.value}">
                     <option value="hoymiles">Hoymiles (DTU)</option>
                     <option value="opendtu">OpenDTU / AhoyDTU</option>
                     <option value="generic">Anderes (EZ1/HA)</option>
                  </select>
               </div>

               <div class="cfg-row">
                  <div class="cfg-info">
                     <div class="cfg-label">Strompreis (ct/kWh)</div>
                     <div class="cfg-desc">Dein aktueller Strompreis zur Berechnung der Ersparnis.</div>
                  </div>
                  <input type="number" step="0.1" class="cfg-num" style="width:220px;" .value="${this.config.electricity_price || 30.0}"
                    @change="${(e) => this.config.electricity_price = parseFloat(e.target.value) || 30.0}">
               </div>

               ${this.config.inverter_type !== 'hoymiles' ? html`
                  <div class="cfg-row">
                     <div class="cfg-info">
                        <div class="cfg-label">External Limit Entity</div>
                        <div class="cfg-desc">Die Number-Entität für das Watt-Limit.</div>
                     </div>
                     <hoymiles-entity-picker .hass="${this.hass}" label="Number Entity" .value="${this.config.external_limit_entity}" domain="number"
                       @value-changed="${(e) => this.config.external_limit_entity = e.detail.value}"></hoymiles-entity-picker>
                  </div>
               ` : ''}
            </div>
          ` : ''}

          ${this.activeSubTab === 'sensors' ? html`
            <div class="config-section glass animate-fade-in" style="grid-column: span 2;">
               <div class="section-title"><ha-icon icon="mdi:nas"></ha-icon> SENSOR ZUORDNUNG</div>
               <div class="picker-grid">
                  <div class="p-card">
                    <div class="p-head">SOLAR LEISTUNG (W/kW)</div>
                    <hoymiles-entity-picker .hass="${this.hass}" .value="${this.config.solar_power_sensor}" @value-changed="${(e) => this.config.solar_power_sensor = e.detail.value}"></hoymiles-entity-picker>
                    <select class="cfg-num" style="width:100%; margin-top:10px;" .value="${this.config.solar_power_scale}" @change="${(e) => this.config.solar_power_scale = e.target.value}"><option value="w">Watt (W)</option><option value="kw_to_w">Kilowatt (kW)</option></select>
                  </div>

                  <div class="p-card">
                    <div class="p-head">STROMZÄHLER (W/kW)</div>
                    <hoymiles-entity-picker .hass="${this.hass}" .value="${this.config.grid_sensor}" @value-changed="${(e) => this.config.grid_sensor = e.detail.value}"></hoymiles-entity-picker>
                    <select class="cfg-num" style="width:100%; margin-top:10px;" .value="${this.config.grid_power_scale}" @change="${(e) => this.config.grid_power_scale = e.target.value}"><option value="w">Watt (W)</option><option value="kw_to_w">Kilowatt (kW)</option></select>
                  </div>

                  <div class="p-card">
                    <div class="p-head">BATTERIE LEISTUNG (W/kW)</div>
                    <hoymiles-entity-picker .hass="${this.hass}" .value="${this.config.battery_power_sensor}" @value-changed="${(e) => this.config.battery_power_sensor = e.detail.value}"></hoymiles-entity-picker>
                    <div class="cfg-row" style="margin-top:10px; border:none; padding:0;">
                       <span class="cfg-desc">Invertieren</span>
                       <ha-switch .checked="${this.config.battery_power_invert}" @change="${(e) => this.config.battery_power_invert = e.target.checked}"></ha-switch>
                    </div>
                  </div>

                  <div class="p-card">
                    <div class="p-head">BATTERIE SOC (%)</div>
                    <hoymiles-entity-picker .hass="${this.hass}" .value="${this.config.battery_soc_sensor}" @value-changed="${(e) => this.config.battery_soc_sensor = e.detail.value}"></hoymiles-entity-picker>
                  </div>

                  <div class="p-card">
                    <div class="p-head">SOLAR ERTRAG HEUTE (kWh/Wh)</div>
                    <hoymiles-entity-picker .hass="${this.hass}" .value="${this.config.solar_energy_yield_sensor}" @value-changed="${(e) => this.config.solar_energy_yield_sensor = e.detail.value}"></hoymiles-entity-picker>
                    <select class="cfg-num" style="width:100%; margin-top:10px;" .value="${this.config.solar_yield_scale}" @change="${(e) => this.config.solar_yield_scale = e.target.value}"><option value="none">Kilowattstunden (kWh)</option><option value="wh_to_kwh">Wattstunden (Wh)</option></select>
                  </div>

                  <div class="p-card">
                    <div class="p-head">NETZ BEZUG HEUTE (kWh/Wh)</div>
                    <hoymiles-entity-picker .hass="${this.hass}" .value="${this.config.grid_energy_import_sensor}" @value-changed="${(e) => this.config.grid_energy_import_sensor = e.detail.value}"></hoymiles-entity-picker>
                    <select class="cfg-num" style="width:100%; margin-top:10px;" .value="${this.config.grid_import_scale}" @change="${(e) => this.config.grid_import_scale = e.target.value}"><option value="none">Kilowattstunden (kWh)</option><option value="wh_to_kwh">Wattstunden (Wh)</option></select>
                  </div>

                  <div class="p-card">
                    <div class="p-head">NETZ EINSPEISUNG HEUTE (kWh/Wh)</div>
                    <hoymiles-entity-picker .hass="${this.hass}" .value="${this.config.grid_energy_export_sensor}" @value-changed="${(e) => this.config.grid_energy_export_sensor = e.detail.value}"></hoymiles-entity-picker>
                    <select class="cfg-num" style="width:100%; margin-top:10px;" .value="${this.config.grid_export_scale}" @change="${(e) => this.config.grid_export_scale = e.target.value}"><option value="none">Kilowattstunden (kWh)</option><option value="wh_to_kwh">Wattstunden (Wh)</option></select>
                  </div>
                  
                  ${this._expertMode ? html`
                  <div class="p-card" style="grid-column: span 2;">
                    <div class="p-head">PHASEN-SALDIERUNG (OPTIONAL)</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px;">
                       <hoymiles-entity-picker .hass="${this.hass}" label="L1" .value="${this.config.grid_sensor_l1}" @value-changed="${(e) => this.config.grid_sensor_l1 = e.detail.value}"></hoymiles-entity-picker>
                       <hoymiles-entity-picker .hass="${this.hass}" label="L2" .value="${this.config.grid_sensor_l2}" @value-changed="${(e) => this.config.grid_sensor_l2 = e.detail.value}"></hoymiles-entity-picker>
                       <hoymiles-entity-picker .hass="${this.hass}" label="L3" .value="${this.config.grid_sensor_l3}" @value-changed="${(e) => this.config.grid_sensor_l3 = e.detail.value}"></hoymiles-entity-picker>
                    </div>
                  </div>
                  ` : ''}
               </div>
            </div>
          ` : ''}

          ${this.activeSubTab === 'algorithm' ? html`
            <div class="config-section glass animate-fade-in" style="grid-column: span 2;">
               <div class="section-title"><ha-icon icon="mdi:brain"></ha-icon> REGELUNG (ZEN)</div>
               <div class="cfg-row">
                  <div class="cfg-info">
                     <div class="cfg-label">Ziel-Bezug am Zähler</div>
                     <div class="cfg-desc">Puffer (z.B. 10W) gegen ungewollte Einspeisung.</div>
                  </div>
                  <input type="number" class="cfg-num" .value="${this.config.target_grid_watt || 10}" @change="${(e) => this.config.target_grid_watt = e.target.value}">
               </div>

               <div class="cfg-row">
                  <div class="cfg-info">
                     <div class="cfg-label">Max. AC Leistung (Watt)</div>
                  </div>
                  <input type="number" class="cfg-num" .value="${this.config.max_capacity || 800}" @change="${(e) => this.config.max_capacity = e.target.value}">
               </div>

               ${this._expertMode ? html`
                <div class="cfg-row">
                   <div class="cfg-info">
                      <div class="cfg-label">Hysterese</div>
                      <div class="cfg-desc">Regel-Schwellenwert in Watt.</div>
                   </div>
                   <input type="number" class="cfg-num" .value="${this.config.zero_export_hysteresis || 5}" @change="${(e) => this.config.zero_export_hysteresis = e.target.value}">
                </div>
                <div class="cfg-row">
                   <div class="cfg-info">
                      <div class="cfg-label">Regel-Intervall</div>
                      <div class="cfg-desc">Sekunden zwischen Berechnungen.</div>
                   </div>
                   <input type="number" class="cfg-num" .value="${this.config.zero_export_interval || 10}" @change="${(e) => this.config.zero_export_interval = e.target.value}">
                </div>
               ` : ''}
            </div>
          ` : ''}

          ${this.activeSubTab === 'safety' ? html`
            <div class="config-section glass animate-fade-in" style="grid-column: span 2;">
                <div class="section-title"><ha-icon icon="mdi:battery-shield"></ha-icon> SICHERHEIT & SCHUTZ</div>
                <div class="cfg-row">
                   <div class="cfg-info">
                      <div class="cfg-label">Batterieschutz</div>
                      <div class="cfg-desc">Stoppt Einspeisung bei niedrigem SOC.</div>
                   </div>
                   <ha-switch .checked="${this.config.battery_protection_enabled}" @change="${(e) => this.config.battery_protection_enabled = e.target.checked}"></ha-switch>
                </div>
                
                ${this.config.battery_protection_enabled ? html`
                <div class="cfg-row animate-fade-in">
                   <div class="cfg-info">
                      <div class="cfg-label">Limits (Min / Restart) %</div>
                   </div>
                   <div style="display:flex; gap:10px;">
                      <input type="number" class="cfg-num" style="width:80px;" .value="${this.config.battery_min_soc || 10}" @change="${(e) => this.config.battery_min_soc = e.target.value}">
                      <input type="number" class="cfg-num" style="width:80px;" .value="${this.config.battery_restart_soc || 15}" @change="${(e) => this.config.battery_restart_soc = e.target.value}">
                   </div>
                </div>
                ` : ''}

                <div class="cfg-row" style="margin-top:20px;">
                   <div class="cfg-info">
                      <div class="cfg-label">Wetter-Schutz</div>
                   </div>
                   <ha-switch .checked="${this.config.weather_protection_enabled}" @change="${(e) => this.config.weather_protection_enabled = e.target.checked}"></ha-switch>
                </div>
            </div>
          ` : ''}

          ${this.activeSubTab === 'devices' ? html`
             <div class="config-section glass" style="grid-column: span 2;">
                <div class="cfg-row"><span>Zusatzgeräte Dashboard anzeigen</span> <ha-switch .checked="${this.config.enable_sub_consumers}" @change="${(e) => { this.config.enable_sub_consumers = e.target.checked; this.requestUpdate(); }}"></ha-switch></div>
                ${this.config.enable_sub_consumers ? html`
                  <div class="sub-config-grid" style="margin-top:20px;">
                    ${[1,2,3,4].map(i => html`
                      <div class="p-card">
                        <div class="p-head">GERÄT ${i}</div>
                        <div class="cfg-compact-row">
                          <input type="text" class="cfg-text" placeholder="Name" .value="${this.config[`sub_consumer_${i}_name`]}" @input="${(e) => this.config[`sub_consumer_${i}_name`] = e.target.value}">
                          <input type="text" list="mdi-icons-list" class="cfg-text" placeholder="Icon (mdi:plug)" .value="${this.config[`sub_consumer_${i}_icon`]}" @input="${(e) => this.config[`sub_consumer_${i}_icon`] = e.target.value}">
                        </div>
                        <hoymiles-entity-picker .hass="${this.hass}" label="Sensor" .value="${this.config[`sub_consumer_${i}_sensor`]}" @value-changed="${(e) => this.config[`sub_consumer_${i}_sensor`] = e.detail.value}"></hoymiles-entity-picker>
                        <hoymiles-entity-picker .hass="${this.hass}" label="Schalter (Optional)" .domain="switch" .value="${this.config[`sub_consumer_${i}_toggle`]}" @value-changed="${(e) => this.config[`sub_consumer_${i}_toggle`] = e.detail.value}"></hoymiles-entity-picker>
                      </div>
                    `)}
                  </div>
                ` : ''}
             </div>
          ` : ''}
        </div>
        <datalist id="mdi-icons-list">
          <option value="mdi:power-plug">Stecker (Standard)</option>
          <option value="mdi:bitcoin">Bitcoin Miner</option>
          <option value="mdi:car-electric">E-Auto / Wallbox</option>
          <option value="mdi:water-boiler">Boiler / Warmwasser</option>
          <option value="mdi:heat-pump-outline">Wärmepumpe</option>
          <option value="mdi:television">TV / Media</option>
          <option value="mdi:desktop-pc">Computer / PC</option>
          <option value="mdi:server">Server / NAS</option>
          <option value="mdi:router-wireless">Router / Netzwerk</option>
          <option value="mdi:washing-machine">Waschmaschine</option>
          <option value="mdi:tumble-dryer">Trockner</option>
          <option value="mdi:dishwasher">Spülmaschine</option>
          <option value="mdi:fan">Lüfter / Klima</option>
          <option value="mdi:lightbulb">Beleuchtung</option>
          <option value="mdi:pool">Pool / Pumpe</option>
          <option value="mdi:battery-charging">Akku / Batterie</option>
        </datalist>
        <button class="mega-save-btn" @click="${this._saveConfig}"><ha-icon icon="mdi:content-save-check" style="margin-right:10px;"></ha-icon> EINSTELLUNGEN ÜBERNEHMEN</button>
      </div>
    `;
  }

  renderDisplayUpdate() { 
    return html`
      <div class="settings-page animate-fade-in" style="text-align:center; padding-top: 80px;">
         <div style="position:relative; display:inline-block; margin-bottom: 30px;">
            <div style="position:absolute; inset:-30px; background:radial-gradient(circle, var(--kairo-cyan) 0%, transparent 70%); opacity:0.15; filter:blur(20px); border-radius:50%;"></div>
            <ha-icon icon="mdi:monitor-dashboard" style="font-size: 8em; color: var(--kairo-cyan); filter: drop-shadow(0 0 25px var(--kairo-cyan));"></ha-icon>
         </div>
         <h1 style="font-size: 3.5em; font-weight: 900; letter-spacing: 6px; margin: 0; background: linear-gradient(90deg, #fff, var(--kairo-cyan)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">DISPLAYS & OTA</h1>
         <p style="color: #8b949e; font-size: 1.2em; max-width: 600px; margin: 25px auto; line-height: 1.6;">
            Die zentrale Verwaltung für externe OpenKairo Hardware-Displays und die drahtlose Firmware-Verteilung (OTA) befindet sich aktuell noch in der Entwicklung.
         </p>
         <div style="margin-top: 50px; display: inline-flex; align-items: center; gap: 15px; background: rgba(0,242,255,0.05); padding: 15px 35px; border-radius: 40px; border: 1px solid rgba(0,242,255,0.2); box-shadow: 0 0 30px rgba(0,242,255,0.05);">
            <div class="status-dot active" style="width: 12px; height: 12px; box-shadow: 0 0 15px var(--kairo-cyan); background: var(--kairo-cyan);"></div>
            <span style="font-weight: 900; letter-spacing: 3px; color: var(--kairo-cyan); font-size: 1.1em;">COMING SOON</span>
         </div>
      </div>
    `; 
  }
  
  renderHelp() {
    return html`
      <div class="settings-page animate-fade-in">
        <div class="setup-header">
          <div class="setup-header-inner">
             <div class="setup-title">HILFE & SUPPORT</div>
          </div>
        </div>
        <div class="help-grid">
           <div class="help-section">
             <h4><ha-icon icon="mdi:rocket-launch"></ha-icon> SCHNELLSTART</h4>
             <p>Konfiguriere unter <strong>SETUP -> Sensoren</strong> deinen Stromzähler (Netzbezug/Einspeisung) und deinen Wechselrichter (Solarleistung). Aktiviere dann in der Menüleiste oben den <strong>ZEN-MODUS</strong>, um die Nulleinspeisung zu starten.</p>
           </div>
           <div class="help-section">
             <h4><ha-icon icon="mdi:nas"></ha-icon> TAGESWERTE & BILANZ</h4>
             <p>Damit die Autarkie- und Eigenverbrauchsanzeige im Dashboard funktioniert, müssen zwingend die Sensoren für <strong>Ertrag, Bezug und Einspeisung (Heute)</strong> unter SETUP in kWh oder Wh hinterlegt sein.</p>
           </div>
           <div class="help-section">
             <h4><ha-icon icon="mdi:shield-check"></ha-icon> SICHERHEIT</h4>
             <p>Das System regelt die Limits nur innerhalb der von dir gesetzten Grenzen (Min/Max). Achte darauf, dass unter SETUP -> Regelung das maximale Hardware-Limit (z.B. 800W) deines Wechselrichters korrekt eingetragen ist.</p>
           </div>
           <div class="help-section">
             <h4><ha-icon icon="mdi:battery-charging"></ha-icon> BATTERIESCHUTZ</h4>
             <p>Im Bereich Schutz kannst du verhindern, dass dein Akku komplett entladen wird. Die Einspeisung stoppt automatisch bei Erreichen des Min-SOC und startet erst wieder beim Restart-SOC.</p>
           </div>
           <div class="help-section">
             <h4><ha-icon icon="mdi:update"></ha-icon> SYSTEM UPDATES</h4>
             <p>Aktuelle Version: <strong>v${this._currentVersion}</strong>. Das OpenKairo System prüft automatisch auf Github nach Updates. Wenn ein Update verfügbar ist, erscheint ein Button zum direkten Download.</p>
           </div>
           <div class="help-section">
             <h4><ha-icon icon="mdi:bug"></ha-icon> FEHLERBEHEBUNG</h4>
             <p>Prüfe das <strong>REGLER-LOG</strong> unter dem Tab <strong>ANALYSE</strong>, wenn die Einspeisung nicht wie erwartet regelt. Dort siehst du die genauen mathematischen Entscheidungen des Algorithmus in Echtzeit.</p>
           </div>
        </div>

        <div class="donate-section glass">
          <div class="donate-content">
            <ha-icon icon="mdi:rocket-launch" style="font-size: 3.5em; color: var(--kairo-gold);"></ha-icon>
            <div class="donate-text">
               <h3>OPENKAIRO SUPPORTER WERDEN</h3>
               <p>Unterstütze die Entwicklung von OpenKairo! Mit einer einmaligen Spende oder einem <strong>Business / Supporter Abo</strong> sicherst du die stetige Weiterentwicklung und erhältst Zugang zu exklusiven Updates.</p>
            </div>
          </div>
          <a class="donate-btn" href="https://www.paypal.com/donate/?cmd=_donations&business=info@low-streaming.de&currency_code=EUR&source=url&Z3JncnB0=" target="_blank">
             <ha-icon icon="mdi:star-circle"></ha-icon> BUSINESS / SUPPORTER ABO
          </a>
        </div>
      </div>
    `;
  }

  _toggleSwitch(e) { this.hass.callService('switch', 'toggle', { entity_id: e }); }
  _handleSwitchChange(on) {
    const id = 'switch.zero_export_controller_nulleinspeisung_aktivieren';
    if (this.hass.states[id]) this.hass.callService('switch', on ? 'turn_on' : 'turn_off', { entity_id: id });
  }

  static get styles() {
    return css`
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap');
      
      :host {
        --kairo-cyan: #00f2ff; --kairo-gold: #F7931A; --kairo-pink: #FF007F; --kairo-green: #39FF14;
        --kairo-bg: #05060b; --kairo-surface: rgba(13, 17, 23, 0.85); --kairo-glass-border: rgba(255, 255, 255, 0.08);
        font-family: 'Outfit', sans-serif; color: #fff; display: block; min-height: 100vh; background: var(--kairo-bg);
      }

      .panel-container { 
        min-height: 100vh; position: relative; padding-bottom: 50px; 
        background-image: radial-gradient(circle at 50% -20%, rgba(0, 242, 255, 0.1) 0%, transparent 50%);
        overflow-x: hidden;
      }
      
      .cyber-grid {
        position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 0; pointer-events: none; opacity: 0.4;
        background-image: linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
        background-size: 60px 60px; mask-image: radial-gradient(circle at center, black, transparent 80%);
      }

      .header { display: flex; justify-content: space-between; align-items: center; padding: 40px 60px; position: relative; z-index: 10; }
      .back-btn { width: 44px; height: 44px; border-radius: 14px; background: rgba(255,255,255,0.04); border: 1px solid var(--kairo-glass-border); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.3s; color: #8b949e; flex-shrink: 0; }
      .back-btn:hover { background: rgba(255,255,255,0.08); color: #fff; border-color: var(--kairo-cyan); box-shadow: 0 0 15px rgba(0,242,255,0.2); }
      .logo-area { display: flex; align-items: center; gap: 20px; }
      .logo-icon-kairo { width: 55px; height: 55px; filter: drop-shadow(0 0 10px var(--kairo-cyan)); }
      .logo-text h1 { margin: 0; font-size: 1.8em; letter-spacing: 6px; font-weight: 900; }
      
      .status-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.4); padding: 5px 15px; border-radius: 30px; border: 1px solid var(--kairo-glass-border); margin-top: 8px; }
      .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #444; }
      .status-dot.active { background: var(--kairo-green); box-shadow: 0 0 10px var(--kairo-green); }
      .status-text { font-size: 0.7em; font-weight: 800; color: #8b949e; letter-spacing: 1px; }

      .global-zen-wrap { display: flex; align-items: center; gap: 15px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.05); padding: 8px 20px 8px 10px; border-radius: 30px; transition: 0.4s; backdrop-filter: blur(10px); }
      .global-zen-wrap.active { border-color: var(--kairo-cyan); box-shadow: 0 0 20px rgba(0,242,255,0.1); background: rgba(0,242,255,0.05); }
      .gz-icon { width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; transition: 0.4s; color: #8b949e; }
      .global-zen-wrap.active .gz-icon { background: rgba(0,242,255,0.15); color: var(--kairo-cyan); filter: drop-shadow(0 0 8px var(--kairo-cyan)); }
      .gz-text { display: flex; flex-direction: column; }
      .gz-title { font-size: 0.6em; font-weight: 900; letter-spacing: 1px; color: #8b949e; text-transform: uppercase; }
      .gz-status { font-size: 0.85em; font-weight: 800; color: #fff; }
      .global-zen-wrap.active .gz-status { color: var(--kairo-cyan); }

      .time-area { font-family: 'JetBrains Mono', monospace; font-size: 0.9em; background: rgba(255,255,255,0.02); padding: 12px 24px; border-radius: 16px; border: 1px solid var(--kairo-glass-border); color: var(--kairo-cyan); }

      .main-nav { 
        display: flex; 
        justify-content: center; 
        gap: 15px; 
        margin: 0 auto 50px; 
        padding: 10px; 
        border-radius: 24px; 
        width: fit-content; 
        border: 1px solid rgba(255,255,255,0.1); 
        background: rgba(0,0,0,0.4); 
        backdrop-filter: blur(30px); 
        position: relative; 
        z-index: 100;
        box-shadow: 0 10px 40px rgba(0,0,0,0.4);
      }
      .nav-item { 
        padding: 14px 28px; 
        border-radius: 18px; 
        cursor: pointer; 
        font-size: 0.9em; 
        font-weight: 800; 
        color: #8b949e; 
        transition: 0.4s cubic-bezier(0.4, 0, 0.2, 1); 
        display: flex; 
        align-items: center; 
        gap: 10px;
        letter-spacing: 1px;
      }
      .nav-item:hover { color: #fff; background: rgba(255,255,255,0.05); }
      .nav-item.active { 
        background: var(--kairo-cyan); 
        color: #000; 
        box-shadow: 0 0 30px rgba(0,242,255,0.5); 
        transform: translateY(-2px);
      }

      .glass { background: var(--kairo-surface); backdrop-filter: blur(40px); border: 1px solid var(--kairo-glass-border); border-radius: 32px; box-shadow: 0 30px 60px rgba(0,0,0,0.6); }
      .dashboard-layout { display: grid; grid-template-columns: 1fr 380px; gap: 30px; padding: 0 60px; position: relative; z-index: 10; }
      
      .main-card { padding: 40px; position: relative; min-height: 800px; }
      .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 40px; }
      .sum-card { background: rgba(0,0,0,0.3); padding: 20px; border-radius: 20px; text-align: center; border: 1px solid var(--kairo-glass-border); }
      .sum-label { font-size: 0.65em; color: #8b949e; display: block; margin-bottom: 8px; font-weight: 800; letter-spacing: 1px; }
      .sum-value { font-size: 1.7em; font-weight: 950; font-family: 'JetBrains Mono', monospace; color: #fff; text-shadow: 0 0 20px rgba(255,255,255,0.1); }
      .sum-unit { font-size: 0.6em; margin-left: 3px; color: #8b949e; }

      .visualizer { 
        position: relative; 
        width: 100%; 
        max-width: 700px; 
        aspect-ratio: 600 / 420; 
        margin: 160px auto 0; 
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: visible;
      }
      .canvas { height: 200px; margin-top: 20px; width: 100%; position: relative; border-bottom: 1px solid rgba(255,255,255,0.05); }
      .engine { 
        position: absolute; 
        top: 50%;
        left: 50%;
        width: 600px; 
        height: 420px; 
        transform: translate(-50%, -50%) scale(1.15);
        transform-origin: center center;
      }
      .engine-svg { width: 600px; height: 420px; overflow: visible; display: block; }
      .pth { fill: none; stroke: rgba(255,255,255,0.08); stroke-width: 4; stroke-linecap: round; }

      .inverter-hub { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 140px; height: 140px; background: #0a0b10; border: 2.5px solid var(--kairo-cyan); border-radius: 35px; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 0 30px rgba(0,242,255,0.2); z-index: 50; }
      .hub-label { font-size: 0.65em; color: #8b949e; font-weight: 800; letter-spacing: 2px; }
      .hub-value { font-size: 2.4em; font-weight: 900; font-family: 'JetBrains Mono', monospace; }
      .hub-status { font-size: 0.6em; margin-top: 10px; background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 8px; font-weight: 800; }

      .node { position: absolute; width: 58px; height: 58px; border-radius: 18px; background: #0a0b10; border: 1.5px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 1.4em; transform: translate(-50%, -50%); transition: 0.3s; z-index: 20; }
      .n-solar { border-color: var(--kairo-gold); color: var(--kairo-gold); top: 23.8%; left: 20%; }
      .n-house { border-color: var(--kairo-cyan); color: var(--kairo-cyan); top: 23.8%; left: 80%; }
      .n-grid { border-color: var(--kairo-pink); color: var(--kairo-pink); top: 76.2%; left: 20%; }
      .n-batt { border-color: var(--kairo-green); color: var(--kairo-green); top: 76.2%; left: 80%; }
      
      .power-tag { position: absolute; bottom: -25px; left: 50%; transform: translateX(-50%); background: #000; color: #000; padding: 4px 12px; border-radius: 12px; font-size: 14px; font-weight: 950; border: 1.5px solid rgba(255,255,255,0.2); white-space: nowrap; box-shadow: 0 4px 15px rgba(0,0,0,0.6); z-index: 100; }
      .soc-tag { position: absolute; top: -14px; right: -14px; background: var(--kairo-green); color: #000; font-size: 0.7em; font-weight: 900; padding: 4px 8px; border-radius: 10px; box-shadow: 0 4px 10px rgba(57,255,20,0.3); }

      .particle-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5; }
      .flow-particle { position: absolute; width: 6px; height: 6px; border-radius: 50%; box-shadow: 0 0 10px currentColor; }
      @keyframes flow { from { offset-distance: 0%; } to { offset-distance: 100%; } }

      .sun-arc-wrap { position: absolute; top: -100px; left: 0; width: 100%; height: 120px; opacity: 1; pointer-events: none; z-index: 100; }
      .sun-arc-path { fill: none; stroke: rgba(255,255,255,0.1); stroke-width: 1.2; stroke-dasharray: 2 6; transition: 0.5s; }
      .sun-arc-path.moon-arc { stroke: rgba(0, 242, 255, 0.1); stroke-dasharray: 1 8; }
      .sun-icon { filter: drop-shadow(0 0 15px #ff9d00); transition: 0.5s; }
      .arc-time-label { fill: #c9d1d9; font-size: 10px; font-family: 'JetBrains Mono'; font-weight: 800; transition: 0.5s; text-shadow: 0 0 5px rgba(0,0,0,0.5); }

      .sub-consumers-wrap { position: absolute; top: 50%; right: -30px; transform: translateY(-50%); display: flex; flex-direction: column; gap: 12px; z-index: 60; background: rgba(10, 11, 16, 0.7); padding: 12px; border-radius: 24px; border: 1px solid rgba(255,255,255,0.08); backdrop-filter: blur(10px); box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
      @media (max-width: 600px) {
        .sub-consumers-wrap { top: auto; bottom: -20px; right: 50%; transform: translateX(50%) scale(0.85); flex-direction: row; padding: 10px; border-radius: 24px; }
      }
      .sub-node { width: 52px; height: 52px; border-radius: 16px; background: #05060b; border: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: 0.4s cubic-bezier(0.4, 0, 0.2, 1); color: #8b949e; position: relative; }
      .sub-node:hover { background: rgba(255,255,255,0.05); transform: scale(1.08); z-index: 10; }
      .sub-node.on { border-color: var(--kairo-green); color: var(--kairo-green); box-shadow: 0 0 20px rgba(57,255,20,0.15), inset 0 0 10px rgba(57,255,20,0.05); }
      .sub-node .s-val { font-size: 0.65em; font-weight: 900; margin-top: 4px; font-family: 'JetBrains Mono', monospace; }
      .sub-node .s-lab { position: absolute; right: 70px; background: rgba(0,0,0,0.9); padding: 8px 14px; border-radius: 10px; font-size: 0.75em; font-weight: 800; white-space: nowrap; opacity: 0; transition: 0.3s; pointer-events: none; border: 1px solid var(--kairo-glass-border); box-shadow: 0 5px 15px rgba(0,0,0,0.5); }
      .sub-node:hover .s-lab { opacity: 1; transform: translateX(-5px); }
      @media (max-width: 600px) {
        .sub-node .s-lab { right: auto; bottom: 70px; }
        .sub-node:hover .s-lab { transform: translateY(-5px); }
      }

      .sidebar { display: flex; flex-direction: column; gap: 30px; }
      .side-card { padding: 35px; }
      .s-cap { font-size: 0.8em; font-weight: 800; color: #8b949e; margin-bottom: 25px; letter-spacing: 2px; text-transform: uppercase; }
      .s-flex { display: flex; align-items: flex-start; gap: 24px; }
      .s-icon { width: 64px; height: 64px; background: rgba(255,255,255,0.04); border-radius: 20px; display: flex; align-items: center; justify-content: center; font-size: 1.8em; border: 1px solid var(--kairo-glass-border); }
      .s-icon.orange { color: var(--kairo-gold); border-color: rgba(247,147,26,0.2); }
      .s-vals { flex: 1; }
      .s-row { display: flex; justify-content: space-between; font-size: 1em; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.03); }
      .s-row span:last-child { font-weight: 800; font-family: 'JetBrains Mono', monospace; }
      .green { color: var(--kairo-green) !important; }

      .settings-page { max-width: 1200px; margin: 0 auto; animation: slideUp 0.6s ease-out; }
      @keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
      .setup-header { margin-bottom: 40px; border-left: 4px solid var(--kairo-gold); padding-left: 25px; }
      .setup-title { font-size: 1.8em; font-weight: 900; letter-spacing: 2px; }
      .setup-header-inner { display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 15px; }
      .expert-badge { padding: 10px 20px; border-radius: 12px; display: flex; align-items: center; gap: 15px; border: 1px solid var(--kairo-glass-border); background: rgba(0,0,0,0.3); }
      
      .zen-master-switch { display: flex; justify-content: space-between; align-items: center; padding: 20px 30px; margin-bottom: 30px; border-radius: 20px; transition: 0.4s; }
      .zen-master-switch.active { border-color: var(--kairo-cyan); box-shadow: 0 0 30px rgba(0,242,255,0.1), inset 0 0 20px rgba(0,242,255,0.05); }
      .zms-info { display: flex; align-items: center; gap: 20px; }
      .zms-icon-wrap { width: 50px; height: 50px; border-radius: 14px; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; transition: 0.4s; }
      .zen-master-switch.active .zms-icon-wrap { background: rgba(0,242,255,0.1); }
      .zms-icon { font-size: 1.8em; color: #8b949e; transition: 0.4s; }
      .zen-master-switch.active .zms-icon { color: var(--kairo-cyan); filter: drop-shadow(0 0 10px var(--kairo-cyan)); }
      .zms-title { font-size: 1.1em; font-weight: 900; letter-spacing: 2px; color: #fff; }
      .zms-desc { font-size: 0.8em; color: #8b949e; margin-top: 4px; font-weight: 600; }
      .zen-master-switch.active .zms-desc { color: var(--kairo-cyan); }

      .sub-nav { 
        display: flex; 
        gap: 10px; 
        margin-bottom: 35px; 
        background: rgba(0,0,0,0.2); 
        padding: 6px; 
        border-radius: 16px; 
        width: fit-content;
        border: 1px solid rgba(255,255,255,0.05);
      }
      .sub-item { 
        cursor: pointer; 
        color: #8b949e; 
        font-size: 0.8em; 
        font-weight: 800; 
        text-transform: uppercase; 
        letter-spacing: 1px; 
        padding: 10px 20px;
        border-radius: 12px;
        transition: 0.3s;
      }
      .sub-item:hover { color: #fff; }
      .sub-item.active { background: rgba(0,242,255,0.1); color: var(--kairo-cyan); }

      .section-title { 
        font-size: 0.75em; 
        font-weight: 900; 
        color: var(--kairo-gold); 
        letter-spacing: 2px; 
        text-transform: uppercase; 
        margin-bottom: 25px; 
        display: flex; 
        align-items: center; 
        gap: 10px; 
      }
      .picker-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
      .p-card { 
        background: rgba(0,0,0,0.3); 
        padding: 20px; 
        border-radius: 20px; 
        border: 1px solid var(--kairo-glass-border); 
        transition: 0.3s;
      }
      .p-card:hover { border-color: var(--kairo-gold); background: rgba(0,0,0,0.5); }
      .p-head { font-size: 0.65em; font-weight: 800; color: #8b949e; margin-bottom: 15px; letter-spacing: 1px; }
      
      .sub-config-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }

      .config-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: 30px; }
      .config-section { padding: 30px; }
      .cfg-row { display: flex; justify-content: space-between; align-items: center; padding: 15px 0; border-bottom: 1px solid rgba(255,255,255,0.03); }
      .cfg-label { font-weight: 800; font-size: 1.1em; }
      .cfg-desc { font-size: 0.8em; color: #8b949e; }
      .cfg-num { background: #000; border: 1.5px solid var(--kairo-glass-border); color: #fff; padding: 12px; border-radius: 12px; width: 120px; font-family: 'JetBrains Mono', monospace; outline: none; }
      .cfg-num:focus { border-color: var(--kairo-cyan); }
      .cfg-text { background: #000; border: 1.5px solid var(--kairo-glass-border); color: #fff; padding: 12px; border-radius: 12px; width: 100%; outline: none; }
      .cfg-compact-row { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; }

      .mega-save-btn { 
        width: 100%; 
        padding: 22px; 
        background: linear-gradient(135deg, var(--kairo-cyan), #00d2ff); 
        color: #000; 
        border: none; 
        border-radius: 20px; 
        font-weight: 900; 
        letter-spacing: 2px; 
        cursor: pointer; 
        margin-top: 40px; 
        box-shadow: 0 15px 40px rgba(0,242,255,0.3); 
        font-size: 1.1em; 
        transition: 0.3s;
      }
      .mega-save-btn:hover { transform: translateY(-3px); box-shadow: 0 20px 50px rgba(0,242,255,0.4); }
      
      .canvas { background: #000; border-radius: 15px; overflow: hidden; border: 1px solid var(--kairo-glass-border); }
      .flow-legend { display: flex; justify-content: center; gap: 20px; margin-top: 20px; }
      .leg-item { display: flex; align-items: center; gap: 8px; font-size: 0.8em; font-weight: 800; color: #8b949e; }
      .dot { width: 10px; height: 10px; border-radius: 50%; }
      .neon-orange-bg { background: var(--kairo-gold); box-shadow: 0 0 10px var(--kairo-gold); }
      .neon-green-bg { background: var(--kairo-green); box-shadow: 0 0 10px var(--kairo-green); }
      .neon-pink-bg { background: var(--kairo-pink); box-shadow: 0 0 10px var(--kairo-pink); }

      .help-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 25px; }
      .help-section { background: rgba(255,255,255,0.02); padding: 30px; border-radius: 24px; border: 1px solid var(--kairo-glass-border); }
      .help-section h4 { color: var(--kairo-gold); margin-top: 0; display: flex; align-items: center; gap: 10px; }
      .help-section p { color: #8b949e; line-height: 1.6; margin-bottom: 0; }

      .donate-section { display: flex; align-items: center; justify-content: space-between; padding: 30px 40px; border-radius: 24px; margin-top: 40px; border: 1px solid var(--kairo-gold); background: rgba(247, 147, 26, 0.05); }
      .donate-content { display: flex; align-items: center; gap: 20px; }
      .donate-text h3 { margin: 0 0 5px 0; color: var(--kairo-gold); letter-spacing: 1px; font-weight: 900; }
      .donate-text p { margin: 0; color: #8b949e; font-size: 0.9em; line-height: 1.5; max-width: 450px; }
      .donate-actions { display: flex; gap: 15px; flex-wrap: wrap; justify-content: center; }
      .donate-btn { display: flex; align-items: center; gap: 10px; background: var(--kairo-gold); color: #000; padding: 15px 25px; border-radius: 16px; font-weight: 900; text-decoration: none; transition: 0.3s; letter-spacing: 1px; font-size: 0.9em; border: 2px solid var(--kairo-gold); }
      .donate-btn.outline { background: transparent; color: var(--kairo-gold); }
      .donate-btn.outline:hover { background: rgba(247, 147, 26, 0.1); transform: translateY(-3px); }
      .donate-btn:not(.outline):hover { transform: translateY(-3px); box-shadow: 0 10px 30px rgba(247, 147, 26, 0.3); }

      @media (max-width: 768px) {
        .donate-section { flex-direction: column; gap: 20px; text-align: center; padding: 25px; }
        .donate-content { flex-direction: column; text-align: center; }
        .donate-text p { max-width: 100%; }
        .donate-actions { width: 100%; flex-direction: column; gap: 10px; }
        .donate-btn { width: 100%; justify-content: center; box-sizing: border-box; }
        .settings-page { padding: 0 15px; box-sizing: border-box; }
        .config-grid { grid-template-columns: 1fr; gap: 15px; }
        .config-section { grid-column: 1 / -1 !important; padding: 20px 15px; box-sizing: border-box; }
        .canvas { height: 160px !important; }
        .dashboard-layout { grid-template-columns: 1fr; padding: 0 15px; }
        .sidebar { flex-direction: row; flex-wrap: wrap; gap: 15px; }
        .side-card { flex: 1; min-width: 280px; padding: 20px; }
        .header { padding: 20px 15px; gap: 15px; flex-direction: column; text-align: center; }
        .global-zen-wrap { width: 100%; box-sizing: border-box; justify-content: space-between; }
        .main-nav { width: 95%; overflow-x: auto; justify-content: flex-start; padding: 8px 15px; }
        .nav-item { padding: 10px 20px; white-space: nowrap; font-size: 0.8em; }
        .cfg-row { flex-direction: column; align-items: flex-start; gap: 10px; }
        .cfg-num, select.cfg-num { width: 100% !important; box-sizing: border-box; }
        .cfg-compact-row { grid-template-columns: 1fr; }
        .setup-header-inner { flex-direction: column; align-items: flex-start; }
        .expert-badge { width: 100%; justify-content: space-between; box-sizing: border-box; }
        .sub-nav { flex-wrap: wrap; justify-content: center; width: 100%; box-sizing: border-box; }
        .sub-item { flex: 1; text-align: center; min-width: 100px; padding: 10px; }
        .summary-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
        .inverter-hub { width: 100px; height: 100px; border-radius: 22px; border-width: 2px; }
        .hub-value { font-size: 1.6em; }
        .hub-label { font-size: 0.5em; }
        .node { width: 44px; height: 44px; font-size: 1.1em; border-radius: 12px; }
        .visualizer { max-width: 100%; }
        .engine { transform: translate(-50%, -50%) scale(0.65); }
        .power-tag { font-size: 0.6em; bottom: -22px; padding: 2px 6px; }
        .soc-tag { font-size: 0.6em; top: -10px; right: -10px; padding: 2px 6px; }
        .pth { stroke-width: 5; }
      }
      @media (max-width: 480px) {
        .summary-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
        .sum-card { padding: 12px; }
        .sum-value { font-size: 1.1em; }
        .visualizer { transform: scale(1.05); }
        .logo-text h1 { font-size: 1.2em; letter-spacing: 2px; }
        .hub-value { font-size: 1.6em; }
        .node { width: 42px; height: 42px; font-size: 1.1em; }
      }

      .animate-fade-in { animation: fadeIn 0.6s ease-out forwards; }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
    `;
  }
}
customElements.define("hoymiles-cyd-panel", HoymilesCYDPanel);
