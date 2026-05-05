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
      label { display: block; font-size: 0.75em; color: var(--text-dim); margin-bottom: 8px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
      .input-box { 
        background: rgba(0, 0, 0, 0.4); 
        border: 1px solid var(--glass-border); 
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
      .item { padding: 12px 15px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.03); }
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
      grid_sensor_type: 'net',
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
    this._boundCheckUpdate = this._checkUpdate.bind(this);
  }

  connectedCallback() {
    super.connectedCallback();
    if (this.hass) {
      this._initialize();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._updateEventUnsub) {
      this._updateEventUnsub();
      this._updateEventUnsub = null;
    }
    if (this._historyInterval) {
      clearInterval(this._historyInterval);
      this._historyInterval = null;
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

    // Initial fetch
    this._fetchHistory();
    this._fetchLog();
    this._fetchDisplays();

    // Refresh display list every 10 seconds
    setInterval(() => this._fetchDisplays(), 10000);

    // Listen for update events via HA Connection
    if (this.hass.connection && !this._updateEventUnsub) {
      this._updateEventUnsub = this.hass.connection.subscribeEvents((event) => {
        this._isUpdating = false;
        this._updateStatus = event.data.status === 'success' ? 'Update erfolgreich! Bitte HA neu starten.' : 'Fehler: ' + event.data.message;
        this.requestUpdate();
      }, 'hoymiles_cyd_update_completed');
    }
    this._updateSunPos();
  }

  _updateSunPos() {
    const sun = this.hass.states['sun.sun'];
    if (!sun) return;
    
    const now = new Date();
    const sunrise = new Date(sun.attributes.next_rising);
    const sunset = new Date(sun.attributes.next_setting);
    
    // If next_rising is in the future and next_setting is in the future, 
    // we need to know the PREVIOUS rising/setting to calculate current progress.
    // HA sun entity is a bit tricky, but elevation is a good proxy.
    const elevation = sun.attributes.elevation || 0;
    if (elevation <= 0) {
      this._sunPos = -1;
    } else {
      // Approximate progress based on elevation (0 at sunrise, max at noon, 0 at sunset)
      // This is simplified but effective for a visual arc.
      this._sunPos = Math.min(1, Math.max(0, elevation / 60)); // Assumes 60 deg max elevation
    }
  }

  shouldUpdate(changedProps) {
    // If it's the first render or internal state changed, always update
    if (!changedProps.has('hass')) return true;

    // If hass changed, only update if relevant entities changed
    const oldHass = changedProps.get('hass');
    if (!oldHass || !this.hass) return true;

    // List of sensors we monitor in our config
    const monitorEntities = [
      this.config.solar_power_sensor,
      this.config.grid_sensor,
      this.config.battery_power_sensor,
      this.config.battery_soc_sensor,
      this.config.solar_energy_yield_sensor,
      this.config.grid_energy_import_sensor,
      this.config.grid_energy_export_sensor,
      'sensor.zero_export_controller_nulleinspeisung_status',
      'sensor.zero_export_controller_zero_export_status',
      'sensor.zero_export_controller_nulleinspeisung_leistungslimit',
      'sensor.zero_export_controller_zero_export_limit'
    ];

    // Add sub-consumers
    if (this.config.enable_sub_consumers) {
      for (let i = 1; i <= 4; i++) {
        monitorEntities.push(this.config[`sub_consumer_${i}_sensor`]);
        monitorEntities.push(this.config[`sub_consumer_${i}_toggle`]);
      }
    }

    // Check if any monitored entity has changed its state
    for (const entityId of monitorEntities) {
      if (!entityId) continue;
      if (this.hass.states[entityId] !== oldHass.states[entityId]) {
        return true;
      }
    }

    // Check for internal property changes (tabs, update status etc.)
    if (changedProps.has('activeTab') || 
        changedProps.has('_latestVersion') || 
        changedProps.has('_isUpdating') || 
        changedProps.has('_updateStatus')) {
      return true;
    }

    return false;
  }

  updated(changedProps) {
    if (changedProps.has('hass') && this.hass && !this._configLoaded) {
      this._initialize();
    }
  }

  async _checkUpdate() {
    try {
      // Get local version from our sync API
      const syncResp = await this.hass.callApi('GET', 'hoymiles_cyd_sync');
      this._currentVersion = syncResp.version || 'v1.1.1';

      // Get latest version from GitHub
      const gitResp = await fetch('https://raw.githubusercontent.com/low-streaming/hoymiles_cyd/main/custom_components/hoymiles_cyd/manifest.json');
      const gitManifest = await gitResp.json();
      this._latestVersion = gitManifest.version;
    } catch (e) {
      console.error("Update check failed", e);
    }
  }

  async _fetchLog() {
    try {
      const data = await this.hass.callApi('GET', 'hoymiles_cyd_sync');
      console.log("Log synchronization data:", data);
      if (data) {
        this._decisionLog = data.log || data.history || [];
        this._savedWh = data.saved_wh || data.energy_saved || 0;
        this.requestUpdate();
      }
    } catch (e) {
      console.error("Error fetching log data:", e);
    }
  }


  async _fetchDisplays() {
    try {
      const resp = await this.hass.callApi('GET', 'hoymiles_cyd_displays');
      this._connectedDisplays = resp.displays || {};
    } catch (e) { console.error("Failed to fetch displays", e); }
  }

  async _triggerDisplayUpdate(ip) {
    if (!confirm(`Update für Display ${ip} wirklich starten?`)) return;
    try {
      await this.hass.callApi('POST', 'hoymiles_cyd_trigger_update', { ip });
      this.dispatchEvent(new CustomEvent('hass-notification', {
        detail: { message: "Update-Signal gesendet! Display startet gleich neu.", duration: 3000 },
        bubbles: true, composed: true
      }));
    } catch (e) { alert("Signal-Senden fehlgeschlagen"); }
  }

  async _runUpdate() {
    if (!confirm("Möchtest du das Update jetzt installieren? Die Integration wird dabei überschrieben.")) return;
    this._isUpdating = true;
    this._updateStatus = 'Downloading & Installing...';
    try {
      await this.hass.callService('hoymiles_cyd', 'update_integration', {});
    } catch (e) {
      this._isUpdating = false;
      this._updateStatus = 'Fehler beim Starten des Updates.';
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
    const sensors = [this.config.grid_sensor, this.config.solar_power_sensor, this.config.battery_power_sensor].filter(Boolean);
    if (sensors.length === 0) return;
    try {
      const end = new Date();
      const start = new Date(end.getTime() - 3600000);
      const url = `history/period/${start.toISOString()}?filter_entity_id=${sensors.join(',')}&end_time=${end.toISOString()}`;
      const result = await this.hass.callApi('GET', url);
      
      const historyObj = { grid: [], solar: [], battery: [] };
      if (result && Array.isArray(result)) {
        result.forEach((entityHistory, idx) => {
          if (entityHistory && entityHistory.length > 0) {
            const entityId = entityHistory[0].entity_id;
            // Map by entity_id if available, otherwise by index fallback
            if (entityId === this.config.grid_sensor || (!entityId && idx === 0)) historyObj.grid = entityHistory;
            else if (entityId === this.config.solar_power_sensor || (!entityId && idx === 1)) historyObj.solar = entityHistory;
            else if (entityId === this.config.battery_power_sensor || (!entityId && idx === 2)) historyObj.battery = entityHistory;
          }
        });
        console.log("History synchronized:", Object.keys(historyObj).map(k => `${k}: ${historyObj[k].length} pts`));
        this._historyData = historyObj;
      }
    } catch (e) { console.error("History fetch failed", e); }
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
        <div class="cyber-grid"></div>
        <div class="header">
          <div class="logo-area">
            <div class="logo-icon-kairo">
               <svg viewBox="0 0 100 100" class="k-logo">
                  <path d="M20 20 L20 80 M20 50 L60 20 M20 50 L60 80" stroke="var(--kairo-cyan)" stroke-width="12" stroke-linecap="round" fill="none" filter="url(#neonGlow)"/>
                  <circle cx="70" cy="50" r="10" fill="var(--kairo-gold)" filter="url(#neonGlow)"/>
               </svg>
            </div>
            <div class="logo-text">
              <h1>OPENKAIRO <span style="color: var(--kairo-cyan); opacity: 0.7;">PRO</span></h1>
              <div class="status-badge">
                <span class="status-dot ${zero_export_status.includes('Läuft') ? 'active' : ''}"></span>
                <span class="status-text">${zero_export_status.toUpperCase()}</span>
              </div>
            </div>
          </div>
          <div class="time-area">
            <ha-icon icon="mdi:clock-outline" style="margin-right: 8px; color: var(--kairo-cyan);"></ha-icon>
            ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} | ${new Date().toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit' }).toUpperCase()}
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
    const getScaled = (entityId, scale) => {
      if (!entityId || !this.hass.states[entityId]) return 0;
      const state = this.hass.states[entityId];
      if (!state || state.state === 'unavailable' || state.state === 'unknown') return 0;
      let val = parseFloat(state.state) || 0;
      if (scale === 'kw_to_w') return val * 1000;
      if (scale === 'w_to_kw') return val / 1000;
      return val;
    };

    // Current Power (Watts)
    const solar_p = getScaled(this.config.solar_power_sensor || 'sensor.hoymiles_cyd_ac_power', this.config.solar_power_scale);
    let batt_p = getScaled(this.config.battery_power_sensor, this.config.battery_power_scale);
    if (this.config.battery_power_invert) batt_p = batt_p * -1;

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
      grid_p = house_consumption - solar_p;
    } else {
      const raw_grid_p = getScaled(this.config.grid_sensor, this.config.grid_power_scale);
      if (this.config.grid_sensor_type === 'consumption') {
        house_consumption = raw_grid_p;
        grid_p = Math.round(house_consumption + (batt_p || 0) - solar_p, 0);
      } else {
        grid_p = raw_grid_p;
        house_consumption = Math.max(0, solar_p + grid_p - (batt_p || 0));
      }
    }

    // Energy (kWh)
    const yield_today = getScaled(this.config.solar_energy_yield_sensor || 'sensor.hoymiles_cyd_today_yield', this.config.solar_yield_scale);
    const import_today = getScaled(this.config.grid_energy_import_sensor, this.config.grid_import_scale);
    const export_today = getScaled(this.config.grid_energy_export_sensor, this.config.grid_export_scale);
    const battery_soc = parseFloat(this.hass.states[this.config.battery_soc_sensor]?.state) || 0;

    const inverter_temp = (this.hass.states['sensor.hoymiles_cyd_wechselrichtertemperatur'] || this.hass.states['sensor.hoymiles_cyd_temperature'])?.state || '--';
    const control_limit = (this.hass.states['sensor.zero_export_controller_nulleinspeisung_leistungslimit'] || this.hass.states['sensor.zero_export_controller_zero_export_limit'])?.state || '0';

    const formatPower = (w) => {
      if (Math.abs(w) >= 1000) return (w / 1000).toFixed(2) + ' kW';
      return Math.round(w) + ' W';
    };

    return html`
      <div class="dashboard-layout animate-fade-in">
        <div class="main-card glass">
          
          <!-- Summary Badges -->
          <div class="summary-grid">
            <div class="sum-card">
              <span class="sum-label">Solar Heute</span>
              <span class="sum-value">${yield_today.toFixed(2)}<span class="sum-unit">kWh</span></span>
            </div>
            <div class="sum-card">
              <span class="sum-label">Netz Bezug</span>
              <span class="sum-value">${import_today.toFixed(2)}<span class="sum-unit">kWh</span></span>
            </div>
            <div class="sum-card">
              <span class="sum-label">Netz Einspeisung</span>
              <span class="sum-value">${export_today.toFixed(2)}<span class="sum-unit">kWh</span></span>
            </div>
            <div class="sum-card">
              <span class="sum-label">Haus Gesamt</span>
              <span class="sum-value">${(import_today + yield_today - export_today).toFixed(2)}<span class="sum-unit">kWh</span></span>
            </div>
          </div>

          <div class="visualizer">
            <!-- Sun Arc -->
            ${this._renderSunArc()}

            <div class="engine">
              <svg class="engine-svg" viewBox="0 0 600 420">
                <defs>
                   <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                <!-- Static Paths -->
                <path id="p_solar_inv" d="M 120 100 Q 300 100 300 210" class="pth" />
                <path id="p_inv_house" d="M 300 210 Q 300 100 480 100" class="pth" />
                <path id="p_grid_inv" d="M 120 320 Q 300 320 300 210" class="pth" />
                <path id="p_inv_batt" d="M 300 210 Q 300 320 480 320" class="pth" />
                <path id="p_inv_grid" d="M 300 210 Q 300 320 120 320" style="fill:none;" />
                <path id="p_batt_inv" d="M 480 320 Q 300 320 300 210" style="fill:none;" />
              </svg>

              <!-- CSS Particle Layer (Immune to SVG bugs) -->
              <div class="particle-layer">
                 ${solar_p > 10 ? this._renderCSSFlow('M 120 100 Q 300 100 300 210', solar_p, '#F7931A') : ''}
                 ${house_consumption > 10 ? this._renderCSSFlow('M 300 210 Q 300 100 480 100', house_consumption, '#00f2ff') : ''}
                 ${grid_p > 10 ? this._renderCSSFlow('M 120 320 Q 300 320 300 210', grid_p, '#ff007f') : ''}
                 ${grid_p < -10 ? this._renderCSSFlow('M 300 210 Q 300 320 120 320', Math.abs(grid_p), '#00f2ff') : ''}
                 ${batt_p > 10 ? this._renderCSSFlow('M 300 210 Q 300 320 480 320', batt_p, '#39FF14') : ''}
                 ${batt_p < -10 ? this._renderCSSFlow('M 480 320 Q 300 320 300 210', Math.abs(batt_p), '#39FF14') : ''}
              </div>

              <!-- Center Hub -->
              <div class="inverter-hub ${grid_p > 20 ? 'import' : grid_p < -20 ? 'export' : 'balanced'}">
                <span class="hub-label">NETZ-BILANZ</span>
                <span class="hub-value">${Math.abs(grid_p).toFixed(0)}<span class="hub-unit">W</span></span>
                <span class="hub-status" style="background: rgba(255,255,255,0.05); color: #fff;">LIMIT: ${control_limit === 'unknown' ? '--' : control_limit}%</span>
              </div>

              <!-- Nodes -->
              <div class="node n-solar neon-border-orange" style="top: 23.8%; left: 20%;">
                <ha-icon icon="mdi:solar-power-variant"></ha-icon>
                <div class="power-tag neon-bg-orange" style="background: var(--neon-orange); bottom: -25px;">${formatPower(solar_p)}</div>
              </div>
              
              <div class="node n-house neon-border-blue" style="top: 23.8%; left: 80%;">
                <ha-icon icon="mdi:home-lightning-bolt-outline"></ha-icon>
                <div class="power-tag neon-bg-blue" style="background: var(--neon-blue); bottom: -25px;">${formatPower(house_consumption)}</div>
              </div>
              
              <div class="node n-grid neon-border-pink" style="top: 76.2%; left: 20%;">
                <ha-icon icon="mdi:transmission-tower-export"></ha-icon>
                <div class="power-tag" style="background: ${grid_p > 0 ? 'var(--neon-pink)' : 'var(--neon-cyan)'}; bottom: -25px;">${formatPower(grid_p)}</div>
              </div>
              
              <div class="node n-batt neon-border-green" style="top: 76.2%; left: 80%;">
                <ha-icon icon="${battery_soc > 20 ? 'mdi:battery-high' : 'mdi:battery-low'}"></ha-icon>
                <div class="batt-bar-wrap">
                   <div class="batt-bar-fill" style="height: ${battery_soc}%"></div>
                </div>
                <div class="soc-tag neon-bg-green">${battery_soc.toFixed(0)}%</div>
                ${Math.abs(batt_p) > 5 ? html`<div class="power-tag neon-bg-green" style="bottom: -25px;">${formatPower(Math.abs(batt_p))} ${batt_p > 0 ? 'LADEN' : 'ENTLADEN'}</div>` : ''}
              </div>

              <!-- Sub Consumers Area -->
              ${this.config.enable_sub_consumers ? html`
              <div class="sub-consumers-wrap">
                ${[1, 2, 3, 4].map(i => {
      const sensor = this.config[`sub_consumer_${i}_sensor`];
      const name = this.config[`sub_consumer_${i}_name`];
      const icon = this.config[`sub_consumer_${i}_icon`] || 'mdi:power-plug';
      const toggle = this.config[`sub_consumer_${i}_toggle`];
      if (!name && !sensor) return '';

      const state_val = sensor ? parseFloat(this.hass.states[sensor]?.state || 0) : 0;
      const scale = this.config[`sub_consumer_${i}_scale`];
      const power_w = scale === 'kw_to_w' ? state_val * 1000 : state_val;
      const isOn = toggle ? (this.hass.states[toggle]?.state === 'on') : (power_w > 5);

      return html`
                    <div class="sub-node ${isOn ? 'on' : ''}" @click="${() => toggle && this._toggleSwitch(toggle)}">
                      <div class="s-lab">${name}</div>
                      <ha-icon icon="${icon}"></ha-icon>
                      <div class="s-val">${power_w.toFixed(0)}W</div>
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
                ${inverter_temp !== '--' ? html`<div class="s-row"><span>WR Temp</span> <span>${inverter_temp}°C</span></div>` : ''}
                ${(this.config.inverter_type === 'hoymiles' && this._currentVersion) ? html`<div class="s-row"><span>DTU Version</span> <span>${this._currentVersion}</span></div>` : ''}
                ${(!this.config.inverter_type.includes('hoymiles') && this._currentVersion) ? html`<div class="s-row"><span>Version</span> <span>${this._currentVersion}</span></div>` : ''}
              </div>
            </div>
          </div>

          <div class="side-card glass">
            <div class="s-cap">BILANZ HEUTE</div>
            <div class="s-flex">
              <div class="s-icon"><ha-icon icon="mdi:finance"></ha-icon></div>
              <div class="s-vals">
                <div class="s-row"><span>Autarkie</span> <span class="green">${(import_today + yield_today - export_today) > 0.1 ? Math.max(0, Math.min(100, ((yield_today - export_today) / (import_today + yield_today - export_today) * 100))).toFixed(1) : '0.0'}%</span></div>
                <div class="s-row"><span>Eigenverbrauch</span> <span class="green">${yield_today > 0.1 ? Math.max(0, Math.min(100, ((yield_today - export_today) / yield_today * 100))).toFixed(1) : '0.0'}%</span></div>
              </div>
            </div>
          </div>
          <div class="side-card glass" style="border-color: var(--kairo-gold); margin-top: 15px;">
            <div class="s-cap">ERSPARNIS (GESCHÄTZT)</div>
            <div class="s-flex">
              <div class="s-icon" style="color: var(--kairo-gold);"><ha-icon icon="mdi:piggy-bank-outline"></ha-icon></div>
              <div class="s-vals">
                <div class="s-row"><span>Gespart</span> <span style="color: var(--kairo-gold); font-weight: 700;">${(this._savedWh / 1000).toFixed(2)} kWh</span></div>
                <div class="s-row"><span>Wert (30ct)</span> <span style="color: #fff;">${((this._savedWh / 1000) * 0.30).toFixed(2)} €</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _renderSunArc() {
    if (this._sunPos === -1) return ''; // Night
    
    // Path: M 35,78 Q 260,-45 485,78
    // We calculate position along this quadratic bezier curve.
    // Progress is this._sunPos (0 to 1)
    const t = this._sunPos;
    const x = (1-t)**2 * 35 + 2*(1-t)*t * 260 + t**2 * 485;
    const y = (1-t)**2 * 78 + 2*(1-t)*t * (-45) + t**2 * 78;

    return html`
      <div class="sun-arc-wrap">
        <svg viewBox="0 0 520 100" style="overflow: visible;">
          <path d="M 35,78 Q 260,-45 485,78" class="sun-arc-path" />
          <g style="transform: translate(${x}px, ${y}px)">
            <circle r="6" fill="#ff9d00" class="sun-icon" />
            <circle r="12" fill="rgba(255,157,0,0.2)" />
          </g>
        </svg>
      </div>
    `;
  }

  _renderCSSFlow(path, power, color) {
    const dur = Math.max(1, 6 - (Math.log10(power + 1) * 2));
    const count = Math.min(8, Math.max(2, Math.ceil(power / 100)));
    return html`
      <div class="flow-group" style="pointer-events: none;">
        ${Array.from({ length: count }).map((_, i) => html`
          <div class="flow-particle"
            style="offset-path: path('${path}'); 
                   background: ${color};
                   box-shadow: 0 0 10px ${color};
                   animation: flow ${dur}s linear infinite; 
                   animation-delay: -${(i * (dur/count)).toFixed(2)}s;">
          </div>
        `)}
      </div>
    `;
  }

  _generateStackedPaths() {
    const w = 500, h = 120;
    const points = 50; // Resolution
    const now = new Date().getTime();
    const startTime = now - 3600000;
    
    const getValAt = (history, time) => {
      if (!history || !Array.isArray(history) || history.length === 0) return 0;
      // Find closest state before or at time
      const entry = history.slice().reverse().find(e => {
        const t_str = e.last_changed || e.last_updated || e.lu;
        return t_str ? new Date(t_str).getTime() <= time : false;
      });
      if (!entry) {
        // If no entry before this time, use the first available one as fallback
        const first = history[0];
        return parseFloat(first.state || first.s) || 0;
      }
      return parseFloat(entry.state || entry.s) || 0;
    };

    const solarData = [], battData = [], gridData = [];
    for (let i = 0; i < points; i++) {
      const t = startTime + (i / (points - 1)) * 3600000;
      let s = Math.max(0, getValAt(this._historyData.solar, t));
      
      let b_raw = getValAt(this._historyData.battery, t);
      if (this.config.battery_power_invert) b_raw = b_raw * -1;
      let b = Math.max(0, b_raw * -1); // Discharge is now positive
      
      let g = Math.max(0, getValAt(this._historyData.grid, t)); 
      
      solarData.push(s);
      battData.push(b);
      gridData.push(g);
    }

    const maxTotal = Math.max(...solarData.map((s, i) => s + battData[i] + gridData[i]), 1);
    const scale = isFinite(h / maxTotal) ? h / maxTotal : 1;

    const createPath = (data, offsetData = null) => {
      let pts = data.map((v, i) => {
        const x = (i / (points - 1)) * w;
        const base = offsetData ? offsetData[i] : 0;
        const y = h - (v + base) * scale;
        return `${x},${y}`;
      });
      
      let p = `M ${pts[0]}`;
      pts.forEach(pt => p += ` L ${pt}`);
      
      // Close for fill
      if (offsetData) {
        let revOffset = offsetData.map((v, i) => {
          const x = (i / (points - 1)) * w;
          const y = h - v * scale;
          return `${x},${y}`;
        }).reverse();
        revOffset.forEach(pt => p += ` L ${pt}`);
      } else {
        p += ` L ${w},${h} L 0,${h}`;
      }
      return p + " Z";
    };

    // Layer 1: Solar (Bottom)
    const p1 = createPath(solarData);
    // Layer 2: Battery (on top of Solar)
    const p2 = createPath(battData, solarData);
    // Layer 3: Grid (on top of Solar + Battery)
    const p3 = createPath(gridData, solarData.map((s, i) => s + battData[i]));

    return { p1, p2, p3 };
  }

  _generateGraphPath(fill = false) {
    if (!this._historyData || !this._historyData.grid || this._historyData.grid.length < 2) return "";
    const w = 500, h = 120;
    const data = this._historyData.grid.map(d => parseFloat(d.s || d.state) || 0);
    const maxV = Math.max(...data, 100);
    const minV = Math.min(...data, -100);
    const range = Math.max(1, maxV - minV);
    const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - minV) / range) * h}`);
    let p = `M ${pts[0]}`; pts.forEach(pt => p += ` L ${pt}`);
    if (fill) p += ` L ${w},${h} L 0,${h} Z`;
    return p;
  }

  renderAnalyse() {
    return html`
      <div class="analyse-page animate-fade-in">
        <div class="setup-header">
           <div class="setup-title">S_ANALYSE: PERFORMANCE</div>
           <div class="setup-step">Auswertung der Regler-Effizienz und Einsparungen.</div>
        </div>

        <div class="config-grid">
           <!-- Big Graph -->
           <div class="config-section glass" style="grid-column: span 2;">
               <div class="section-title"><ha-icon icon="mdi:chart-bell-curve-cumulative"></ha-icon> ENERGIE-BILANZ (LETZTE STUNDE)</div>
               <div class="canvas" style="height: 250px; margin-top: 20px;">
                  <svg viewBox="0 0 500 120" preserveAspectRatio="none" style="height: 100%; width: 100%;">
                     <defs>
                        <linearGradient id="gradSolar" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="0%" stop-color="#F7931A" stop-opacity="0.8" />
                           <stop offset="100%" stop-color="#F7931A" stop-opacity="0.2" />
                        </linearGradient>
                        <linearGradient id="gradBatt" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="0%" stop-color="#2ecc71" stop-opacity="0.8" />
                           <stop offset="100%" stop-color="#2ecc71" stop-opacity="0.2" />
                        </linearGradient>
                        <linearGradient id="gradGrid" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="0%" stop-color="#ff007f" stop-opacity="0.8" />
                           <stop offset="100%" stop-color="#ff007f" stop-opacity="0.2" />
                        </linearGradient>
                     </defs>
                     ${(() => {
                        const { p1, p2, p3 } = this._generateStackedPaths();
                        const hasData = this._historyData.grid.length > 0 || this._historyData.solar.length > 0;
                        if (!hasData) return html`<text x="250" y="65" fill="var(--text-dim)" text-anchor="middle" font-size="20">Synchronisiere Verlaufsdaten...</text>`;
                        return html`
                          <path d="${p1}" fill="url(#gradSolar)" style="transition: 0.5s;" />
                          <path d="${p2}" fill="url(#gradBatt)" style="transition: 0.5s;" />
                          <path d="${p3}" fill="url(#gradGrid)" style="transition: 0.5s;" />
                        `;
                     })()}
                  </svg>
               </div>
               <div style="display: flex; justify-content: center; gap: 30px; margin-top: 20px;">
                  <div class="leg-item"><div class="dot" style="background: #F7931A;"></div> SOLAR</div>
                  <div class="leg-item"><div class="dot" style="background: #2ecc71;"></div> BATTERIE</div>
                  <div class="leg-item"><div class="dot" style="background: #ff007f;"></div> NETZ</div>
               </div>
               <div style="display: flex; justify-content: space-between; margin-top: 15px; color: var(--text-dim); font-size: 0.7em; letter-spacing: 1px;">
                  <span>VOR 1 STUNDE</span>
                  <span>JETZT</span>
               </div>
            </div>

           <!-- Savings Detail -->
           <div class="config-section glass">
              <div class="section-title"><ha-icon icon="mdi:piggy-bank"></ha-icon> ERSPARNIS</div>
              <div style="text-align: center; padding: 30px 10px;">
                 <div style="font-size: 3em; font-weight: 900; color: var(--kairo-gold); filter: drop-shadow(0 0 10px rgba(247, 147, 26, 0.3));">
                    ${(this._savedWh / 1000).toFixed(2)}<span style="font-size: 0.4em; margin-left: 5px;">kWh</span>
                 </div>
                 <div style="color: var(--text-dim); font-size: 0.8em; margin-top: 5px; letter-spacing: 2px;">GESAMT EINGESPART</div>
                 
                 <div style="margin-top: 30px; display: flex; justify-content: space-around; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 20px;">
                    <div>
                       <div style="font-size: 1.2em; font-weight: bold;">${((this._savedWh / 1000) * 0.30).toFixed(2)} €</div>
                       <div style="font-size: 0.6em; color: var(--text-dim);">WERT (30ct)</div>
                    </div>
                    <div>
                       <div style="font-size: 1.2em; font-weight: bold; color: var(--neon-green);">${(this._savedWh * 0.4).toFixed(0)}g</div>
                       <div style="font-size: 0.6em; color: var(--text-dim);">CO2 REDUKTION</div>
                    </div>
                 </div>
              </div>
           </div>

           <!-- Decision Log Card -->
           <div class="config-section glass" style="grid-column: span 1;">
              <div class="section-title" style="color: var(--kairo-cyan);"><ha-icon icon="mdi:clipboard-pulse-outline"></ha-icon> REGLER-ENTSCHEIDUNGEN</div>
              <div class="log-container" style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 15px; font-family: 'JetBrains Mono', monospace; font-size: 0.85em; max-height: 250px; overflow-y: auto;">
                 ${this._decisionLog.length === 0 ? html`<div style="color: var(--text-dim); text-align: center; padding: 20px;">Warte auf Daten...</div>` : ''}
                 ${this._decisionLog.map(entry => {
                   const [time, action, reason] = entry.split(' | ');
                   return html`
                     <div style="display: flex; gap: 15px; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 4px;">
                       <span style="color: var(--text-dim); min-width: 80px;">${time}</span>
                       <span style="color: var(--kairo-cyan); min-width: 80px; font-weight: bold;">${action}</span>
                       <span style="color: #fff; flex: 1; font-size: 0.9em;">${reason}</span>
                     </div>
                   `;
                 })}
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
           <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
              <div>
                <div class="setup-title">S_SETUP: KONFIGURATION</div>
                <div class="setup-step">Schritt-für-Schritt Einrichtung für optimale Nulleinspeisung.</div>
              </div>
              <div class="glass" style="padding: 10px 20px; border-radius: 12px; display: flex; align-items: center; gap: 15px; border: 1px solid var(--glass-border);">
                 <span style="font-size: 0.8em; font-weight: bold; color: var(--text-dim); letter-spacing: 1px;">EXPERTEN-MODUS</span>
                 <ha-switch .checked="${this._expertMode}" @change="${(e) => this._expertMode = e.target.checked}"></ha-switch>
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
                     <option value="manual_limit">Manuell</option>
                     <option value="disabled">Inaktiv</option>
                  </select>
               </div>

               <div class="cfg-row animate-fade-in" style="display: ${this.config.operation_mode === 'manual_limit' ? 'flex' : 'none'}; border-left: 3px solid var(--accent); padding-left: 15px; background: rgba(247, 147, 26, 0.05); margin-top: -10px; margin-bottom: 20px; border-radius: 0 8px 8px 0;">
                  <div class="cfg-info">
                     <div class="cfg-label" style="color: var(--accent);">Manuelles Limit</div>
                     <div class="cfg-desc">Fester Wert für den Wechselrichter.</div>
                  </div>
                  <div class="input-wrap">
                     <input type="number" class="cfg-num" style="border-color: var(--accent); flex: 1;" .value="${this.config.manual_limit_value || 50}"
                       @change="${(e) => { this.config = { ...this.config, manual_limit_value: e.target.value }; this.requestUpdate(); }}">
                     <select class="cfg-select" style="margin-left: 10px; width: auto; min-width: 60px; padding: 12px 10px;" .value="${this.config.manual_limit_type || 'percent'}"
                       @change="${(e) => { this.config = { ...this.config, manual_limit_type: e.target.value }; this.requestUpdate(); }}">
                        <option value="percent">%</option>
                        <option value="watt">W</option>
                     </select>
                  </div>
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
                        <div class="cfg-desc">Seriennummer des Inverters.</div>
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
                     <hoymiles-entity-picker .hass="${this.hass}" label="Number Entity" .value="${this.config.external_limit_entity}" domain="number"
                       @value-changed="${(e) => this.config = { ...this.config, external_limit_entity: e.detail.value }}"></hoymiles-entity-picker>
                  </div>
               `}
            </div>
          ` : ''}

          ${this.activeSubTab === 'sensors' ? html`
            <div class="config-section glass animate-fade-in" style="grid-column: span 2;">
               <div class="section-title"><ha-icon icon="mdi:nas"></ha-icon> SENSOR ZUORDNUNG</div>
               <div class="picker-grid">
                  <div class="p-card">
                    <div class="p-head"><ha-icon icon="mdi:solar-power"></ha-icon> Solar Leistung (W)</div>
                    <hoymiles-entity-picker .hass="${this.hass}" label="Entität" .value="${this.config.solar_power_sensor}"
                      @value-changed="${(e) => this.config = { ...this.config, solar_power_sensor: e.detail.value }}"></hoymiles-entity-picker>
                    <div class="u-sel">
                       <select @change="${(e) => this.config = { ...this.config, solar_power_scale: e.target.value }}">
                          <option value="none" ?selected="${this.config.solar_power_scale === 'none'}">W</option>
                          <option value="kw_to_w" ?selected="${this.config.solar_power_scale === 'kw_to_w'}">kW -> W</option>
                       </select>
                    </div>
                  </div>

                  <div class="p-card">
                    <div class="p-head"><ha-icon icon="mdi:transmission-tower"></ha-icon> Stromzähler (W)</div>
                    <hoymiles-entity-picker .hass="${this.hass}" label="Entität" .value="${this.config.grid_sensor}"
                      @value-changed="${(e) => this.config = { ...this.config, grid_sensor: e.detail.value }}"></hoymiles-entity-picker>
                    <div class="u-sel">
                        <select @change="${(e) => this.config = { ...this.config, grid_power_scale: e.target.value }}">
                           <option value="none" ?selected="${this.config.grid_power_scale === 'none'}">W</option>
                           <option value="kw_to_w" ?selected="${this.config.grid_power_scale === 'kw_to_w'}">kW -> W</option>
                        </select>
                    </div>
                  </div>

                  <div class="p-card">
                    <div class="p-head"><ha-icon icon="mdi:battery-high"></ha-icon> Batterie SOC (%)</div>
                    <hoymiles-entity-picker .hass="${this.hass}" label="Entität" .value="${this.config.battery_soc_sensor}"
                      @value-changed="${(e) => this.config = { ...this.config, battery_soc_sensor: e.detail.value }}"></hoymiles-entity-picker>
                  </div>

                  <div class="p-card">
                    <div class="p-head"><ha-icon icon="mdi:battery-charging"></ha-icon> Batterie Leistung (W)</div>
                    <hoymiles-entity-picker .hass="${this.hass}" label="Entität" .value="${this.config.battery_power_sensor}"
                      @value-changed="${(e) => this.config = { ...this.config, battery_power_sensor: e.detail.value }}"></hoymiles-entity-picker>
                    <div class="cfg-row" style="margin-top: 10px; border-bottom: none; padding: 0;">
                       <div class="cfg-label" style="font-size: 0.8em;">Richtung umkehren (Invert)</div>
                       <ha-switch .checked="${this.config.battery_power_invert || false}"
                         @change="${(e) => { this.config = { ...this.config, battery_power_invert: e.target.checked }; this.requestUpdate(); }}"></ha-switch>
                    </div>
                  </div>
                  
                  ${this._expertMode ? html`
                  <div class="p-card animate-fade-in" style="grid-column: span 2;">
                    <div class="p-head"><ha-icon icon="mdi:calculator"></ha-icon> Phasen-Saldierung (Optional)</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 10px;">
                       <div>
                         <label style="font-size: 0.7em; color: var(--text-dim);">Phase L1</label>
                         <hoymiles-entity-picker .hass="${this.hass}" .value="${this.config.grid_sensor_l1}"
                           @value-changed="${(e) => this.config = { ...this.config, grid_sensor_l1: e.detail.value }}"></hoymiles-entity-picker>
                       </div>
                       <div>
                         <label style="font-size: 0.7em; color: var(--text-dim);">Phase L2</label>
                         <hoymiles-entity-picker .hass="${this.hass}" .value="${this.config.grid_sensor_l2}"
                           @value-changed="${(e) => this.config = { ...this.config, grid_sensor_l2: e.detail.value }}"></hoymiles-entity-picker>
                       </div>
                       <div>
                         <label style="font-size: 0.7em; color: var(--text-dim);">Phase L3</label>
                         <hoymiles-entity-picker .hass="${this.hass}" .value="${this.config.grid_sensor_l3}"
                           @value-changed="${(e) => this.config = { ...this.config, grid_sensor_l3: e.detail.value }}"></hoymiles-entity-picker>
                       </div>
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
                     <div class="cfg-desc">Standard: 10W Netzbezug.</div>
                  </div>
                  <div class="input-wrap">
                     <input type="number" class="cfg-num" .value="${this.config.target_grid_watt || 0}"
                       @change="${(e) => this.config = { ...this.config, target_grid_watt: e.target.value }}">
                     <span class="unit-tag">W</span>
                  </div>
               </div>

               <div class="cfg-row">
                  <div class="cfg-info">
                     <div class="cfg-label">Max. AC Leistung</div>
                  </div>
                  <div class="input-wrap">
                     <input type="number" class="cfg-num" .value="${this.config.max_capacity || 800}"
                       @change="${(e) => this.config = { ...this.config, max_capacity: e.target.value }}">
                     <span class="unit-tag">W</span>
                  </div>
               </div>
               
               ${this._expertMode ? html`
                <div class="cfg-row animate-fade-in">
                   <div class="cfg-info">
                      <div class="cfg-label">Hysterese</div>
                      <div class="cfg-desc">Abweichung bevor geregelt wird.</div>
                   </div>
                   <div class="input-wrap">
                      <input type="number" class="cfg-num" .value="${this.config.zero_export_hysteresis || 5}"
                        @change="${(e) => this.config = { ...this.config, zero_export_hysteresis: e.target.value }}">
                      <span class="unit-tag">W</span>
                   </div>
                </div>

                <div class="cfg-row animate-fade-in">
                   <div class="cfg-info">
                      <div class="cfg-label">Sanftanlauf (Ramp)</div>
                   </div>
                   <div class="input-wrap">
                      <input type="number" class="cfg-num" .value="${this.config.zero_export_ramp_rate || 50}"
                        @change="${(e) => this.config = { ...this.config, zero_export_ramp_rate: e.target.value }}">
                      <span class="unit-tag">W/s</span>
                   </div>
                </div>
               ` : ''}
            </div>
          ` : ''}

          ${this.activeSubTab === 'safety' ? html`
            <div class="config-section glass animate-fade-in" style="grid-column: span 2;">
                <div class="section-title"><ha-icon icon="mdi:battery-shield"></ha-icon> SICHERHEIT</div>
                <div class="cfg-row">
                   <div class="cfg-info">
                      <div class="cfg-label">Batterieschutz</div>
                      <div class="cfg-desc">Ausschalten bei Min SOC.</div>
                   </div>
                   <ha-switch .checked="${this.config.battery_protection_enabled || false}"
                     @change="${(e) => { this.config = { ...this.config, battery_protection_enabled: e.target.checked }; this.requestUpdate(); }}"></ha-switch>
                </div>
                ${this.config.battery_protection_enabled ? html`
                <div class="cfg-row animate-fade-in">
                   <div class="cfg-info">
                      <div class="cfg-label">Limits (Min / Restart)</div>
                   </div>
                   <div class="input-wrap" style="gap: 10px;">
                      <input type="number" class="cfg-num" style="width: 85px; padding-left: 10px; padding-right: 10px; text-align: center;" .value="${this.config.battery_min_soc || 10}"
                        @change="${(e) => this.config = { ...this.config, battery_min_soc: e.target.value }}">
                      <span style="color: var(--text-dim);">/</span>
                      <input type="number" class="cfg-num" style="width: 85px; padding-left: 10px; padding-right: 10px; text-align: center;" .value="${this.config.battery_restart_soc || 15}"
                        @change="${(e) => this.config = { ...this.config, battery_restart_soc: e.target.value }}">
                      <span class="unit-tag" style="position: static; margin-left: 5px;">%</span>
                   </div>
                </div>
                ` : ''}

                <div class="cfg-row" style="margin-top: 20px;">
                   <div class="cfg-info">
                      <div class="cfg-label">Wetter-Schutz</div>
                   </div>
                   <ha-switch .checked="${this.config.weather_protection_enabled || false}"
                     @change="${(e) => { this.config = { ...this.config, weather_protection_enabled: e.target.checked }; this.requestUpdate(); }}"></ha-switch>
                </div>
                ${this.config.weather_protection_enabled ? html`
                <div class="cfg-row animate-fade-in">
                   <hoymiles-entity-picker .hass="${this.hass}" label="Wetter-Entität" .value="${this.config.weather_sensor}"
                     @value-changed="${(e) => this.config = { ...this.config, weather_sensor: e.detail.value }}"></hoymiles-entity-picker>
                </div>
                ` : ''}
            </div>
          ` : ''}

          ${this.activeSubTab === 'devices' ? html`
            <div class="config-section glass animate-fade-in" style="grid-column: span 2;">
               <div class="section-title" style="display: flex; justify-content: space-between;">
                 <span><ha-icon icon="mdi:devices"></ha-icon> ZUSATZGERÄTE</span>
                 <ha-switch .checked="${this.config.enable_sub_consumers || false}"
                   @change="${(e) => { this.config = { ...this.config, enable_sub_consumers: e.target.checked }; this.requestUpdate(); }}"></ha-switch>
               </div>
               
               ${this.config.enable_sub_consumers ? html`
               <div class="sub-config-grid animate-fade-in" style="margin-top: 20px;">
                  ${[1, 2, 3, 4].map(i => html`
                    <div class="p-card sub-card">
                       <input type="text" class="cfg-text" placeholder="Name" style="margin-bottom: 10px;"
                         .value="${this.config['sub_consumer_' + i + '_name'] || ''}"
                         @input="${(e) => this.config = { ...this.config, ['sub_consumer_' + i + '_name']: e.target.value }}">
                       <hoymiles-entity-picker .hass="${this.hass}" label="Power Sensor" .value="${this.config['sub_consumer_' + i + '_sensor']}"
                         @value-changed="${(e) => this.config = { ...this.config, ['sub_consumer_' + i + '_sensor']: e.detail.value }}"></hoymiles-entity-picker>
                    </div>
                  `)}
               </div>
               ` : ''}
            </div>
          ` : ''}
        </div>

        <button class="mega-save-btn" @click="${this._saveConfig}">
           <ha-icon icon="mdi:content-save-check"></ha-icon>
           EINSTELLUNGEN ÜBERNEHMEN
        </button>
      </div>
    `;
  }

  renderDisplayUpdate() {
    return html`
      <div class="dashboard-layout animate-fade-in">
        <div class="main-card glass" style="max-width: 900px; margin: 0 auto; padding: 60px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; background: rgba(0, 242, 255, 0.03);">
           <div style="background: rgba(0, 242, 255, 0.1); width: 100px; height: 100px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 30px; border: 1px solid rgba(0, 242, 255, 0.2); box-shadow: 0 0 30px rgba(0, 242, 255, 0.1);">
              <ha-icon icon="mdi:tools" style="font-size: 3em; color: var(--kairo-cyan); filter: drop-shadow(0 0 10px rgba(0, 242, 255, 0.5));"></ha-icon>
           </div>
           <h2 style="color: #fff; margin: 0 0 10px 0; font-size: 2em; letter-spacing: 4px; font-weight: 900; text-transform: uppercase;">BALD VERFÜGBAR</h2>
           <p style="color: var(--text-dim); line-height: 1.7; margin: 0; font-size: 1.1em; max-width: 500px;">
             Die drahtlose Over-the-Air (OTA) Firmware-Verwaltung für deine OpenKairo Displays wird aktuell optimiert und steht in Kürze bereit.
           </p>
           <div style="margin-top: 40px; display: flex; gap: 10px;">
              <div style="width: 10px; height: 10px; border-radius: 50%; background: var(--kairo-cyan); animation: pulse 1.5s infinite;"></div>
              <div style="width: 10px; height: 10px; border-radius: 50%; background: var(--kairo-cyan); animation: pulse 1.5s infinite 0.3s;"></div>
              <div style="width: 10px; height: 10px; border-radius: 50%; background: var(--kairo-cyan); animation: pulse 1.5s infinite 0.6s;"></div>
           </div>
        </div>
      </div>
      <style>
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.5); opacity: 1; }
        }
      </style>
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
              <li><strong>Hoymiles DTU:</strong> Direkte Steuerung über die offizielle DTU. Limits werden in Prozent gesetzt.</li>
              <li><strong>OpenDTU / AhoyDTU:</strong> Steuerung über MQTT-Entities (typischerweise ein <code>number</code>-Sensor). Du kannst hier Watt oder % als Skala wählen.</li>
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
            <h4><ha-icon icon="mdi:brain"></ha-icon> 3. ZEN-AUTOMATIK & LIMITS</h4>
            <p>Der <strong>Zero Export Network (ZEN)</strong> Algorithmus berechnet sekündlich das optimale Limit:</p>
            <ul>
              <li><strong>Ziel-Bezug:</strong> Ein kleiner Puffer (z.B. 10W) schützt dich vor ungewollter Einspeisung bei plötzlichen Lastabwürfen.</li>
              <li><strong>Hardware-Limits:</strong> Setze die <strong>Minimale Einspeisung (z.B. 10%)</strong> in den Einstellungen. Das verhindert, dass Dritt-Systeme wie OpenDTU bei zu kleinen Werten (z.B. 0W) abstürzen. Die Automatik regelt sicherheitsbedingt nie unter diesen Wert (außer der Akku ist leer).</li>
              <li><strong>Maximale Einspeisung:</strong> Deckle die Export-Power (z.B. 100%), wenn du Batterien laden oder das Netz schonen möchtest.</li>
            </ul>
          </div>

          <div class="help-section">
            <h4><ha-icon icon="mdi:devices"></ha-icon> 4. ZUSATZVERBRAUCHER</h4>
            <p>Binde gezielt große Geräte wie eine Wärmepumpe oder Speicher an:</p>
            <ul>
              <li><strong>Dashboard-Anzeige:</strong> Geräte über 5W Verbrauch leuchten im Dashboard automatisch als aktives Icon.</li>
              <li><strong>Schalter (Toggle):</strong> Wenn du einen optionalen Schalter angibst, kannst du durch Klick auf das Icon im Dashboard das Gerät ein- oder ausschalten.</li>
              <li><strong>Grundlast-Automatik:</strong> Mit dem Haken "In Grundlast einbeziehen" wird der Live-Verbraucher oben auf die feste Grundlast addiert. Das führt dazu, dass ZEN diesen Strom explizit generiert!</li>
            </ul>
          </div>

          <div class="help-section">
            <h4><ha-icon icon="mdi:battery-shield"></ha-icon> 5. BATTERIESCHUTZ</h4>
            <p>Schütze deinen Speicher vor Tiefen- oder Überladung:</p>
            <ul>
              <li><strong>Aktivierung:</strong> Gib deinen "Batterie SOC (%)" Sensor an und aktiviere den Batterieschutz unter Einstellungen.</li>
              <li><strong>Abschalt-Limit (z.B. 10%):</strong> Erreicht die Batterie diesen Wert, wird die Einspeisung sofort komplett auf 0W gestoppt.</li>
              <li><strong>Einschalt-Limit (z.B. 15%):</strong> Erst wenn dieser Puffer wieder erreicht wurde, nimmt die Nulleinspeisung ihre Arbeit auf (gesunde Hysterese).</li>
            </ul>
          </div>

          <div class="help-section">
            <h4><ha-icon icon="mdi:alert-circle-outline"></ha-icon> 6. FEHLERBEHEBUNG</h4>
            <p>Solltest du Probleme haben:</p>
            <ul>
              <li><strong>Limit-Jitter:</strong> Das System filtert schwankende Anforderungen heraus (0.5% bzw. 5W Threshold), um die Wechselrichter-Logik zu schonen.</li>
              <li><strong>Limit wird nicht gesetzt:</strong> Prüfe, ob die "External Limit Entity" korrekt beschreibbar / erreichbar ist.</li>
              <li><strong>0W statt Limit:</strong> Kontrolliere deine % und Watt Mapping Einstellungen (Watt vs. Prozent Limits).</li>
            </ul>
          </div>

          <div class="help-section">
            <h4><ha-icon icon="mdi:update"></ha-icon> 8. HASS-INTEGRATION UPDATE</h4>
            <div class="glass-card" style="padding: 20px; border: 1px solid var(--glass-border); background: rgba(0,0,0,0.2);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <div>
                        <div style="font-size: 0.9em; color: var(--text-dim);">Aktuelle Version</div>
                        <div style="font-size: 1.2em; font-weight: 700; color: #fff;">v${this._currentVersion}</div>
                    </div>
                </div>

                ${this._latestVersion && this._latestVersion !== this._currentVersion ? html`
                    <div style="background: rgba(57, 255, 20, 0.1); border: 1px solid var(--neon-green); padding: 15px; border-radius: 12px; margin-bottom: 15px; display: flex; align-items: center; gap: 15px;">
                        <ha-icon icon="mdi:alert-decagram" style="color: var(--neon-green);"></ha-icon>
                        <div style="flex: 1; font-size: 0.9em;">Ein neues Update ist auf GitHub verfügbar!</div>
                    </div>
                    <button class="mega-save-btn" style="background: var(--neon-green); color: #000; box-shadow: 0 0 20px rgba(57, 255, 20, 0.3);" 
                        ?disabled="${this._isUpdating}"
                        @click="${this._runUpdate}">
                        ${this._isUpdating ? html`<ha-circular-progress active size="small"></ha-circular-progress>` : 'Update jetzt installieren'}
                    </button>
                ` : html`
                    <div style="text-align: center; color: var(--text-dim); font-size: 0.85em; padding: 10px;">
                        <ha-icon icon="mdi:check-circle" style="color: var(--neon-green); margin-right: 5px;"></ha-icon> Deine Version ist aktuell.
                    </div>
                `}
                
                ${this._updateStatus ? html`
                    <div style="margin-top: 15px; padding: 10px; background: rgba(0,0,0,0.4); border-radius: 8px; font-size: 0.85em; text-align: center; color: var(--accent);">
                        ${this._updateStatus}
                    </div>
                ` : ''}
            </div>
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
        --kairo-cyan: #00f2ff;
        --kairo-gold: #F7931A;
        --kairo-bg: #050508;
        --kairo-surface: rgba(15, 18, 25, 0.85);
        --kairo-glass-border: rgba(255, 255, 255, 0.08);
        --kairo-neon-shadow: 0 0 15px rgba(0, 242, 255, 0.3);
        
        --accent: var(--kairo-gold);
        --accent-glow: rgba(247, 147, 26, 0.3);
        --neon-blue: var(--kairo-cyan);
        --neon-green: #39ff14;
        --neon-pink: #ff007f;
        --neon-cyan: var(--kairo-cyan);
        --neon-orange: var(--kairo-gold);
        --text-main: #ffffff;
        --text-dim: #94a3b8;
        --bg-panel: var(--kairo-surface);
        --glass-border: var(--kairo-glass-border);
        
        display: block;
        min-height: 100vh;
        background: var(--kairo-bg);
        color: var(--text-main);
        font-family: 'Outfit', sans-serif;
        overflow-x: hidden;
      }

      .sub-nav { display: flex; gap: 10px; margin-bottom: 30px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 15px; overflow-x: auto; scrollbar-width: none; }
      .sub-nav::-webkit-scrollbar { display: none; }
      .sub-item { padding: 10px 22px; cursor: pointer; color: var(--text-dim); font-size: 0.8em; font-weight: 800; letter-spacing: 1.5px; border-radius: 25px; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); white-space: nowrap; border: 1px solid transparent; text-transform: uppercase; }
      .sub-item:hover { color: #fff; background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); }
      .sub-item.active { color: #fff; background: var(--kairo-cyan); border-color: var(--kairo-cyan); box-shadow: 0 0 20px rgba(0, 242, 255, 0.3); }

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
      
      /* --- K-FLOW SPECIFIC STYLES --- */
      .sun-arc-wrap { position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 550px; height: 120px; z-index: 1; pointer-events: none; }
      .sun-arc-path { fill: none; stroke: rgba(255,255,255,0.05); stroke-width: 2; stroke-dasharray: 4 6; }
      .sun-icon { filter: drop-shadow(0 0 10px #ff9d00); transition: all 1s ease; }
      
      .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 40px; position: relative; z-index: 10; }
      .sum-card { 
        background: rgba(0,0,0,0.25); border: 1px solid var(--glass-border); border-radius: 16px; padding: 15px;
        display: flex; flex-direction: column; align-items: center; text-align: center;
        transition: 0.3s;
      }
      .sum-card:hover { transform: translateY(-3px); border-color: rgba(255,255,255,0.2); background: rgba(255,255,255,0.03); }
      .sum-label { font-size: 0.65em; font-weight: 700; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
      .sum-value { font-size: 1.3em; font-weight: 800; color: #fff; font-family: 'JetBrains Mono', monospace; }
      .sum-unit { font-size: 0.6em; margin-left: 2px; color: var(--text-dim); }
      
      .inverter-hub {
        position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
        width: 140px; height: 140px; background: #0a0a0c; border: 2px solid var(--accent);
        border-radius: 30px; display: flex; flex-direction: column; align-items: center; justify-content: center;
        box-shadow: 0 0 30px rgba(247, 147, 26, 0.2), inset 0 0 20px rgba(0,0,0,0.8);
        z-index: 20; transition: 0.4s;
      }
      .inverter-hub:hover { transform: translate(-50%, -50%) scale(1.05); }
      .hub-label { font-size: 0.7em; color: var(--text-dim); font-weight: 800; letter-spacing: 2px; margin-bottom: 6px; text-transform: uppercase; }
      .hub-value { font-size: 2.2em; font-weight: 900; color: #fff; line-height: 1; font-family: 'JetBrains Mono', monospace; }
      .hub-unit { font-size: 0.5em; vertical-align: super; margin-left: 2px; color: var(--kairo-cyan); }
      .hub-status { font-size: 0.6em; margin-top: 12px; padding: 4px 12px; border-radius: 8px; background: rgba(255, 255, 255, 0.05); color: #fff; font-weight: 800; letter-spacing: 1px; }

      .leg-item { display: flex; align-items: center; gap: 8px; font-size: 0.75em; font-weight: 700; color: #fff; letter-spacing: 1px; }
      .dot { width: 10px; height: 10px; border-radius: 50%; box-shadow: 0 0 10px currentColor; }

      .pth { fill: none; stroke: rgba(255,255,255,0.05); stroke-width: 2; }
      .engine-svg { width: 100%; height: 100%; pointer-events: none; z-index: 1; overflow: visible; }
      @keyframes flow {
        from { offset-distance: 0%; }
        to { offset-distance: 100%; }
      }
      .flow-dot { 
        offset-rotate: auto;
        will-change: offset-distance;
      }
      .particle-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5; }
      .flow-particle {
        position: absolute; width: 6px; height: 6px; border-radius: 2px;
        border: 1px solid rgba(255,255,255,0.8);
        will-change: offset-distance;
      }

      .inverter-hub.import {
        border-color: var(--neon-pink);
        box-shadow: 0 0 30px rgba(255, 0, 127, 0.2), inset 0 0 20px rgba(0,0,0,0.8);
      }
      .inverter-hub.export {
        border-color: var(--neon-cyan);
        box-shadow: 0 0 30px rgba(0, 242, 255, 0.2), inset 0 0 20px rgba(0,0,0,0.8);
      }
      .inverter-hub.balanced {
        border-color: var(--neon-green);
        box-shadow: 0 0 30px rgba(57, 255, 20, 0.2), inset 0 0 20px rgba(0,0,0,0.8);
        animation: hub-pulse-green 2s infinite ease-in-out;
      }

      @keyframes hub-pulse-green {
        0% { transform: translate(-50%, -50%) scale(1); box-shadow: 0 0 20px rgba(57, 255, 20, 0.2); }
        50% { transform: translate(-50%, -50%) scale(1.03); box-shadow: 0 0 40px rgba(57, 255, 20, 0.4); }
        100% { transform: translate(-50%, -50%) scale(1); box-shadow: 0 0 20px rgba(57, 255, 20, 0.2); }
      }



      .batt-bar-wrap { width: 12px; height: 40px; background: rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden; margin-top: 5px; border: 1px solid rgba(255,255,255,0.1); }
      .batt-bar-fill { width: 100%; background: var(--neon-green); transition: height 1s ease; box-shadow: 0 0 10px var(--neon-green); }
      
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
      .logo-icon-kairo { 
        width: 60px; height: 60px; position: relative;
      }
      .k-logo { width: 100%; height: 100%; overflow: visible; }
      
      .logo-text h1 { 
        margin: 0; font-size: 1.6em; letter-spacing: 4px; font-weight: 900; 
        color: #fff; text-transform: uppercase; 
        filter: drop-shadow(0 0 10px rgba(0, 242, 255, 0.2));
      }
      .status-badge { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
      .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #ff4d4d; box-shadow: 0 0 10px #ff4d4d; }
      .status-dot.active { background: var(--neon-green); box-shadow: 0 0 10px var(--neon-green); }
      .status-text { font-size: 0.7em; font-weight: 800; color: var(--text-dim); letter-spacing: 1px; }

      .time-area { 
        font-family: 'JetBrains Mono', monospace; font-size: 0.85em; color: var(--text-dim); 
        background: rgba(0, 242, 255, 0.05); padding: 10px 20px; border-radius: 15px; 
        border: 1px solid rgba(0, 242, 255, 0.1); display: flex; align-items: center;
      }

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

      /* --- MAIN NAVIGATION --- */
      .main-nav { 
        display: flex; gap: 8px; padding: 6px; margin-bottom: 35px; 
        background: rgba(255,255,255,0.03); border: 1px solid var(--glass-border); 
        border-radius: 20px; width: fit-content;
      }
      .nav-item { 
        padding: 10px 24px; border-radius: 14px; cursor: pointer; 
        font-size: 0.8em; font-weight: 800; color: var(--text-dim); 
        letter-spacing: 1.5px; transition: 0.4s; display: flex; align-items: center; gap: 10px;
        text-transform: uppercase;
      }
      .nav-item ha-icon { --mdc-icon-size: 20px; }
      .nav-item:hover { background: rgba(255,255,255,0.05); color: #fff; }
      .nav-item.active { 
        background: rgba(0, 242, 255, 0.1); color: var(--kairo-cyan); 
        box-shadow: inset 0 0 15px rgba(0, 242, 255, 0.1);
        border: 1px solid rgba(0, 242, 255, 0.2);
      }

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
      .pth-active { stroke-width: 6; stroke-dasharray: 10 15; stroke-linecap: round; opacity: 0.8; filter: drop-shadow(0 0 3px rgba(255,255,255,0.2)); animation: flow-dash 1s linear infinite; }
      @keyframes flow-dash { from { stroke-dashoffset: 25; } to { stroke-dashoffset: 0; } }

      .node { 
        position: absolute; width: 64px; height: 64px; border-radius: 20px; 
        background: #0d0d0f; border: 1.5px solid rgba(255,255,255,0.1); 
        display: flex; align-items: center; justify-content: center; z-index: 10; 
        font-size: 1.6em; box-shadow: 0 10px 25px rgba(0,0,0,0.4);
        transform: translate(-50%, -50%);
        transition: 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      .node:hover { transform: translate(-50%, -50%) scale(1.15) rotate(5deg); border-color: rgba(255,255,255,0.3); }
      .n-solar { color: var(--accent); border-color: rgba(247, 147, 26, 0.4); box-shadow: 0 0 25px rgba(247, 147, 26, 0.15); }
      .n-house { color: #fff; border-color: rgba(255,255,255,0.2); }
      .n-grid { color: #8e8e93; border-color: rgba(255,255,255,0.1); }
      .n-batt { color: #2ecc71; border-color: rgba(46, 204, 113, 0.3); }
      
      .soc-tag { 
        position: absolute; top: -14px; right: -14px; background: #2ecc71; color: #000; 
        font-size: 0.75em; font-weight: 800; padding: 4px 10px; border-radius: 12px; 
        box-shadow: 0 4px 12px rgba(46, 204, 113, 0.4);
      }
      .power-tag { 
        position: absolute; bottom: -14px; left: 50%; transform: translateX(-50%); background: #2ecc71; color: #000; 
        font-size: 0.70em; font-weight: 800; padding: 3px 8px; border-radius: 10px; white-space: nowrap;
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

      /* --- LEGEND OVERRIDES --- */
      .flow-legend { display: flex; flex-wrap: wrap; justify-content: center; gap: 15px; margin-top: 30px; padding: 15px; background: rgba(0,0,0,0.15); border-radius: 16px; border: 1px solid var(--glass-border); }
      .leg-item { display: flex; align-items: center; gap: 8px; font-size: 0.85em; color: var(--text-dim); font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
      .dot { width: 10px; height: 10px; border-radius: 50%; box-shadow: 0 0 8px currentColor; }
      .neon-orange-bg { background: var(--accent); color: var(--accent); }
      .neon-blue-bg { background: var(--neon-blue); color: var(--neon-blue); }
      .neon-pink-bg { background: var(--neon-pink); color: var(--neon-pink); }
      .neon-cyan-bg { background: var(--neon-cyan); color: var(--neon-cyan); }
      .neon-green-bg { background: #2ecc71; color: #2ecc71; }

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
      .config-section { overflow: visible !important; position: relative; z-index: 5; }
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
      .help-header { border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 25px; margin-bottom: 45px; display: flex; align-items: center; gap: 20px; color: #fff; }
      .help-header h3 { margin: 0; font-size: 1.8em; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; }
      .help-header ha-icon { font-size: 2.5em; color: var(--accent); filter: drop-shadow(0 0 15px var(--accent-glow)); }
      .help-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 35px; }
      @media (max-width: 900px) {
        .help-grid { grid-template-columns: 1fr; gap: 25px; }
        .help-content { padding: 30px; }
      }
      .help-section { 
        background: rgba(255,255,255,0.02); border: 1px solid var(--glass-border); 
        border-radius: 24px; padding: 40px; transition: 0.4s cubic-bezier(0.165, 0.84, 0.44, 1); position: relative;
        box-shadow: inset 0 0 20px rgba(0,0,0,0.2), 0 10px 30px rgba(0,0,0,0.3);
        display: flex; flex-direction: column;
      }
      .help-section:hover { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.15); transform: translateY(-5px); box-shadow: inset 0 0 30px rgba(255,255,255,0.01), 0 20px 40px rgba(0,0,0,0.5); }
      .help-section::before {
        content: ''; position: absolute; top: 0; left: 40px; width: 60px; height: 4px;
        background: var(--accent); border-radius: 0 0 6px 6px; box-shadow: 0 0 15px var(--accent-glow);
      }
      .help-section h4 { 
        color: #fff; font-size: 1.3em; font-weight: 900; margin: 0 0 25px 0; 
        display: flex; align-items: center; gap: 18px; letter-spacing: 1px; text-transform: uppercase;
      }
      .help-section ha-icon { 
        color: var(--accent); background: rgba(247, 147, 26, 0.1); padding: 12px; 
        border-radius: 16px; font-size: 1.4em; border: 1px solid rgba(247, 147, 26, 0.2);
        box-shadow: inset 0 0 15px rgba(247, 147, 26, 0.05);
      }
      .help-section p { color: var(--text-dim); line-height: 1.8; font-size: 1em; margin-bottom: 25px; margin-top: 0; }
      .help-section ul { padding-left: 0; color: var(--text-dim); list-style: none; margin: 0; display: flex; flex-direction: column; gap: 18px; flex: 1; }
      .help-section li { font-size: 0.95em; line-height: 1.7; position: relative; padding-left: 24px; }
      .help-section li::before { content: '•'; color: var(--accent); font-size: 2em; line-height: 0.7; position: absolute; left: 0; top: 2px; }
      .help-section strong { color: #fff; font-weight: 700; letter-spacing: 0.5px; }
      .help-footer { margin-top: 70px; text-align: center; }
      .footer-line { height: 1px; background: linear-gradient(90deg, transparent, var(--glass-border), transparent); margin-bottom: 30px; }
      .help-footer p { font-size: 0.9em; color: var(--text-dim); font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; }

      @media (max-width: 1200px) {
        .dashboard-layout { grid-template-columns: 1fr; }
        .sidebar { order: 2; }
      }
      
      @media (max-width: 600px) {
        .main-card { padding: 25px 20px; min-height: auto; }
        .labels-top { flex-direction: column; gap: 15px; }
        .labels-top .box { padding: 15px; display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.4); text-align: left !important; }
        .labels-top .lab { margin-bottom: 0; }
        .labels-top .val { font-size: 1.6em; }
        
        .engine { transform: none; width: 100%; margin: 30px 0; aspect-ratio: 600/420; }
        .node { width: 44px; height: 44px; font-size: 1.1em; border-radius: 12px; }
        .pth-active { stroke-width: 4; }
        .g-inner { width: 90%; height: 90%; }
        .g-main { font-size: 2.2em; }
        
        .flow-legend { gap: 12px; margin-top: 15px; }
        .leg-item { font-size: 0.75em; }
        
        .picker-grid { grid-template-columns: 1fr; }
        .sub-config-grid { grid-template-columns: 1fr; }
        .cfg-row { flex-direction: column; align-items: stretch; gap: 10px; padding: 15px 0;}
        .cfg-num, .cfg-select, .input-wrap { width: 100%; max-width: none; box-sizing: border-box; }
        .mega-save-btn { padding: 18px; font-size: 1.1em; }
        
        /* Mobile Help & Tabs fixes */
        .tabs { padding: 6px; gap: 6px; }
        .tab { padding: 12px 10px; font-size: 0.75em; letter-spacing: 0; min-width: auto; }
        .help-header { flex-direction: column; text-align: center; gap: 15px; margin-bottom: 30px; }
        .help-header h3 { font-size: 1.4em; letter-spacing: 1px; word-break: break-word; line-height: 1.4; }
        .help-header ha-icon { font-size: 2em; }
        .help-section { padding: 30px 20px; }
        .help-section::before { left: 20px; width: 40px; }
        .help-section h4 { font-size: 1.1em; gap: 12px; margin-bottom: 20px; }
        .help-section ha-icon { padding: 10px; font-size: 1.2em; }
        .setup-title { font-size: 1.4em; line-height: 1.3; }
      }

      /* Sub Consumers Dashboard */
      .sub-consumers-wrap {
        position: absolute;
        top: 24%;
        right: -10px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        z-index: 60;
      }
      @media (max-width: 600px) {
        .sub-consumers-wrap { right: 0; transform: scale(0.85); transform-origin: top right; top: 18%; }
      }
      .sub-node {
        width: 54px;
        height: 54px;
        border-radius: 16px;
        background: #111;
        border: 1px solid var(--glass-border);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        position: relative;
        cursor: pointer;
        transition: 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        color: var(--text-dim);
      }
      .sub-node:hover { transform: scale(1.1) translateX(-5px); border-color: var(--accent); color: #fff; z-index: 100; }
      .sub-node.on { 
        border-color: var(--neon-green); 
        box-shadow: 0 0 15px rgba(57, 255, 20, 0.2); 
        color: var(--neon-green); 
      }
      .sub-node ha-icon { --mdc-icon-size: 22px; }
      .sub-node .s-val { font-size: 0.65em; font-weight: 800; margin-top: 2px; font-family: 'JetBrains Mono', monospace; }
      .sub-node .s-lab { 
        position: absolute; right: 65px; white-space: nowrap; font-size: 0.75em; font-weight: 700; 
        color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px;
        opacity: 0; transform: translateX(10px); transition: 0.3s; pointer-events: none;
        background: rgba(0,0,0,0.8); padding: 4px 10px; border-radius: 8px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.5);
      }
      .sub-node:hover .s-lab { opacity: 1; transform: translateX(0); }

      /* Sub Settings Grid */
      .sub-config-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
      .sub-card { padding: 20px; }
      .cfg-compact-row { display: flex; flex-direction: column; gap: 15px; margin-bottom: 25px; }
      .cfg-text { 
        background: rgba(0,0,0,0.3); border: 1.5px solid var(--glass-border); color: #fff; 
        padding: 12px 16px; border-radius: 12px; width: 100%; box-sizing: border-box; outline: none; font-size: 0.95em;
        transition: 0.3s;
      }
      .cfg-text:focus { border-color: var(--accent); box-shadow: 0 0 10px rgba(247, 147, 26, 0.2); }
      .cfg-select-small {
        background: #1a1a1f; color: #fff; border: 1.5px solid var(--glass-border);
        padding: 12px 16px; border-radius: 12px; font-size: 0.9em; outline: none; cursor: pointer;
        width: 100%; box-sizing: border-box;
        transition: 0.3s;
      }
      .cfg-select-small:hover, .cfg-select-small:focus { border-color: var(--accent); }
      .cfg-row-mini { display: flex; justify-content: space-between; align-items: center; font-size: 0.85em; color: var(--text-dim); }
    `;
  }
}
customElements.define("hoymiles-cyd-panel", HoymilesCYDPanel);
