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
      const start = new Date(end.getTime() - 3600000); // 1 hour
      const result = await this.hass.callApi(
        'GET',
        `history/period/${start.toISOString()}?filter_entity_id=${this.config.grid_sensor}&end_time=${end.toISOString()}`
      );
      if (result && result.length > 0) {
        this._historyData = result[0];
      }
    } catch (e) {
      console.error("Error fetching history", e);
    }
  }

  async _saveConfig() {
    try {
      await this.hass.callApi('POST', 'hoymiles_cyd/config', this.config);
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
      <div class="panel-container">
        <div class="header">
          <div class="logo-area">
            <span class="logo-icon">⚡</span>
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
    const yielding_today = this.hass.states['sensor.hoymiles_cyd_today_yield']?.state || '0';

    // Calculate house consumption: Production + Grid (Grid is positive if importing, negative if exporting)
    const house_consumption = Math.max(0, solar_power + grid_power);

    // Gauge calculation (0-100% based on limit or flow)
    const gauge_deg = (limit / 100) * 180;

    return html`
      <div class="dashboard-grid">
        <!-- LEFT: Energy Flow & Gauge -->
        <div class="energy-overview-card glass">
          <div class="card-header">ENERGY OVERVIEW (ZERO EXPORT)</div>
          
          <div class="flow-container">
            <!-- Labels -->
            <div class="label-box solar">
              <span class="label">Solar Production</span>
              <span class="value orange">${(solar_power / 1000).toFixed(1)} kW</span>
            </div>
            
            <div class="label-box house">
              <span class="label">House Consumption</span>
              <span class="value">${(house_consumption / 1000).toFixed(1)} kW</span>
            </div>

            <!-- Flow Visual -->
            <div class="visual-engine">
              <!-- Icons -->
              <div class="icon-node home"><ha-icon icon="mdi:home"></ha-icon></div>
              <div class="icon-node solar-node"><ha-icon icon="mdi:solar-panel-large"></ha-icon></div>
              <div class="icon-node grid-node"><ha-icon icon="mdi:transmission-tower"></ha-icon></div>
              <div class="icon-node battery-node"><ha-icon icon="mdi:battery"></ha-icon></div>

              <!-- Flow Lines (SVG) -->
              <svg class="flow-lines" viewBox="0 0 400 300">
                <path d="M 120 150 Q 150 150 200 150" class="line-path" /> <!-- Solar to Center -->
                <path d="M 280 150 Q 250 150 200 150" class="line-path" /> <!-- House to Center -->
                <path d="M 200 150 Q 200 200 120 250" class="line-path" /> <!-- Center to Grid -->
                <path d="M 200 150 Q 200 200 280 250" class="line-path" /> <!-- Center to Battery -->
                
                <!-- Animated Particles (Simulated) -->
                <circle r="3" fill="#F7931A" class="particle">
                  <animateMotion dur="2s" repeatCount="indefinite" path="M 120 150 Q 150 150 200 150" />
                </circle>
              </svg>

              <!-- Central Gauge -->
              <div class="central-gauge">
                <div class="gauge-ring"></div>
                <div class="gauge-fill" style="transform: rotate(${gauge_deg}deg)"></div>
                <div class="gauge-content">
                  <span class="gauge-label">GRID BALANCE</span>
                  <span class="gauge-value">${Math.abs(grid_power)} W</span>
                  <span class="gauge-sub">${grid_power >= 0 ? 'IMPORTING' : 'EXPORTING'}</span>
                  <ha-icon icon="mdi:transmission-tower"></ha-icon>
                </div>
              </div>
            </div>
          </div>

          <!-- Bottom Graph -->
          <div class="live-graph-area">
             <div class="graph-header">
               <span>LIVE GRID POWER</span>
               <span class="sub">Last hour <ha-icon icon="mdi:chevron-down"></ha-icon></span>
             </div>
             <div class="graph-canvas">
                <svg viewBox="0 0 400 100" class="sparkline">
                   <path d="${this._generateGraphPath()}" class="graph-line" fill="none" />
                   <path d="${this._generateGraphPath(true)}" class="graph-area" />
                </svg>
                <div class="graph-axes">
                  <span>0 W</span>
                  <span>Avg.</span>
                  <span>-0 W</span>
                </div>
             </div>
          </div>
        </div>

        <!-- RIGHT: Stats Stack -->
        <div class="stats-stack">
          <!-- Inverter Status -->
          <div class="stat-card glass">
            <div class="stat-header">INVERTER STATUS</div>
            <div class="stat-body">
              <div class="stat-icon-box"><ha-icon icon="mdi:inverter"></ha-icon></div>
              <div class="stat-details">
                <div class="detail-row"><span>Status</span> <span class="status online">ONLINE ●</span></div>
                <div class="detail-row"><span>Today Yield</span> <span>${yielding_today} kWh</span></div>
                <div class="detail-row"><span>Temperature</span> <span>${this.hass.states['sensor.hoymiles_cyd_temperature']?.state || '0'}°C</span></div>
              </div>
            </div>
          </div>

          <!-- Grid Balance -->
          <div class="stat-card glass">
            <div class="stat-header">GRID BALANCE</div>
            <div class="stat-body">
              <div class="stat-icon-box orange"><ha-icon icon="mdi:transmission-tower"></ha-icon></div>
              <div class="stat-details">
                <div class="detail-row"><span>Current</span> <span>${grid_power} W</span></div>
                <div class="detail-row"><span>Today Export</span> <span>0.0 kWh</span></div>
                <div class="detail-row"><span>Today Import</span> <span>1.2 kWh</span></div>
              </div>
            </div>
          </div>

          <!-- Yield Today -->
          <div class="stat-card glass">
            <div class="stat-header">YIELD TODAY</div>
            <div class="stat-body">
              <div class="stat-icon-box orange"><ha-icon icon="mdi:solar-power"></ha-icon></div>
              <div class="stat-details">
                <div class="detail-row"><span>Production</span> <span>${yielding_today} kWh</span></div>
                <div class="detail-row"><span>Usage</span> <span>-- kWh</span></div>
                <div class="detail-row"><span>Autarky</span> <span class="orange">100%</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _generateGraphPath(fill = false) {
    if (!this._historyData || this._historyData.length < 2) return "M 0 50 L 400 50";

    const max = 400; // SVG Width
    const height = 100; // SVG Height
    const data = this._historyData.map(d => parseFloat(d.s) || 0);
    const minVal = Math.min(...data, -100);
    const maxVal = Math.max(...data, 100);
    const range = maxVal - minVal;

    let points = data.map((val, i) => {
      const x = (i / (data.length - 1)) * max;
      const y = height - ((val - minVal) / range) * height;
      return `${x},${y}`;
    });

    let path = `M ${points[0]}`;
    points.forEach(p => path += ` L ${p}`);

    if (fill) {
      path += ` L ${max},${height} L 0,${height} Z`;
    }
    return path;
  }

  renderSettings() {
    return html`
      <div class="settings-container">
        <div class="card glass">
          <div class="section-header">⚙️ ALLGEMEINE KONFIGURATION</div>
          <div class="settings-row">
            <div class="info">
              <div class="label">Nulleinspeisung Aktivieren</div>
              <div class="desc">Hauptschalter für die Regelung.</div>
            </div>
            <ha-switch 
              .checked="${this.hass.states['switch.zero_export_controller_nulleinspeisung_aktivieren']?.state === 'on'}"
              @change="${() => this._toggleSwitch('switch.zero_export_controller_nulleinspeisung_aktivieren')}"
            ></ha-switch>
          </div>
          
          <div class="settings-row">
             <div class="info">
               <div class="label">Ziel-Netzbezug</div>
               <div class="desc">Gewünschter Watt-Wert am Zähler.</div>
             </div>
             <div class="input-group">
               <input type="number" .value="${this.hass.states['number.zero_export_controller_nulleinspeisung_ziel_netzleistung']?.state || 0}"
                 @change="${(e) => this._setNumber('number.zero_export_controller_nulleinspeisung_ziel_netzleistung', e.target.value)}">
               <span>W</span>
             </div>
          </div>
        </div>

        <div class="card glass">
           <div class="section-header">📡 SENSOREN</div>
           <p class="desc">Wähle hier die Hardware aus, die deine Daten liefert.</p>
           <ha-entity-picker .hass="${this.hass}" .value="${this.config.grid_sensor}" .includeDomains="${['sensor']}" label="Netz-Leistungssensor (Watt)"
             @value-changed="${(e) => this.config = { ...this.config, grid_sensor: e.detail.value }}"></ha-entity-picker>
        </div>

        <div class="save-area">
           <button class="btn-save" @click="${this._saveConfig}">EINSTELLUNGEN SPEICHERN</button>
        </div>
      </div>
    `;
  }

  renderHelp() {
    return html`
      <div class="help-container">
        <div class="card glass help-item">
          <h3>📘 ÜBER DAS SYSTEM</h3>
          <p>Dieses Center steuert deinen Hoymiles Inverter proaktiv. Es verhindert unnötige Einspeisung ins Netz, indem es die Erzeugung exakt an deinen Echtzeit-Verbrauch anpasst.</p>
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
        display: block;
        padding: 0;
        background: #08080a;
        color: #e0e0e0;
        min-height: 100vh;
        font-family: 'Outfit', 'Inter', sans-serif;
        --accent: #F7931A;
        --bg-glass: rgba(25, 25, 30, 0.7);
        --border-glass: rgba(255, 255, 255, 0.1);
      }

      .panel-container {
        max-width: 1400px;
        margin: 0 auto;
        padding: 20px;
      }

      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 25px;
        padding: 10px 0;
      }

      .logo-area { display: flex; align-items: center; gap: 15px; }
      .logo-icon { 
        font-size: 2.2em; 
        background: var(--accent); 
        width: 50px; height: 50px; 
        display: flex; align-items: center; justify-content: center; 
        border-radius: 12px; 
        box-shadow: 0 0 20px rgba(247, 147, 26, 0.4);
      }
      .logo-text h1 { margin: 0; font-size: 1.2em; letter-spacing: 1px; color: #fff; }
      .version-tag { font-size: 0.7em; color: var(--accent); font-weight: bold; }

      .time-area { font-size: 0.9em; color: #888; font-weight: 500; }

      .tabs { display: flex; gap: 10px; margin-bottom: 30px; }
      .tab { 
        padding: 12px 25px; 
        background: rgba(255,255,255,0.03); 
        border: 1px solid var(--border-glass); 
        border-radius: 6px; 
        cursor: pointer; 
        font-size: 0.8em; 
        font-weight: bold; 
        letter-spacing: 1px;
        transition: 0.3s;
      }
      .tab:hover { background: rgba(255,255,255,0.08); }
      .tab.active { 
        background: var(--accent); 
        color: #fff; 
        border-color: var(--accent);
        box-shadow: 0 4px 15px rgba(247, 147, 26, 0.3);
      }

      .dashboard-grid {
        display: grid;
        grid-template-columns: 1fr 320px;
        gap: 20px;
      }

      .glass {
        background: var(--bg-glass);
        backdrop-filter: blur(15px);
        border: 1px solid var(--border-glass);
        border-radius: 16px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.4);
      }

      .energy-overview-card {
        padding: 30px;
        position: relative;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        min-height: 600px;
      }

      .card-header { font-size: 0.9em; font-weight: bold; color: #aaa; margin-bottom: 40px; }

      .flow-container {
        flex: 1;
        position: relative;
        display: flex;
        justify-content: center;
        align-items: center;
      }

      .label-box { position: absolute; display: flex; flex-direction: column; align-items: center; }
      .label-box.solar { top: 20px; left: 40px; }
      .label-box.house { top: 20px; right: 40px; }
      .label-box .label { font-size: 0.8em; color: #888; margin-bottom: 4px; }
      .label-box .value { font-size: 1.8em; font-weight: bold; }
      .value.orange { color: var(--accent); text-shadow: 0 0 10px rgba(247, 147, 26, 0.3); }

      .visual-engine { position: relative; width: 400px; height: 300px; }
      .icon-node { 
        position: absolute; width: 45px; height: 45px; 
        background: rgba(255,255,255,0.05); 
        border: 1px solid var(--border-glass);
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        z-index: 5;
      }
      .home { top: 0; right: 0; }
      .solar-node { top: 0; left: 0; border-color: var(--accent); color: var(--accent); }
      .grid-node { bottom: 0; left: 0; }
      .battery-node { bottom: 0; right: 0; }

      .flow-lines { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
      .line-path { stroke: rgba(255,255,255,0.1); stroke-width: 2; fill: none; }
      .particle { filter: drop-shadow(0 0 5px var(--accent)); }

      .central-gauge {
        position: absolute;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        width: 220px; height: 220px;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
      }
      .gauge-ring { 
        position: absolute; width: 100%; height: 100%; 
        border-radius: 50%; 
        border: 8px solid rgba(255,255,255,0.03);
      }
      .gauge-fill {
        position: absolute; width: 100%; height: 100%;
        border-radius: 50%;
        border: 8px solid transparent;
        border-top-color: var(--accent);
        filter: drop-shadow(0 0 8px var(--accent));
        transition: 1s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .gauge-content { text-align: center; z-index: 10; padding-top: 10px; }
      .gauge-label { font-size: 0.7em; letter-spacing: 2px; color: #888; }
      .gauge-value { display: block; font-size: 2.2em; font-weight: bold; margin: 5px 0; color: #fff; }
      .gauge-sub { font-size: 0.6em; color: var(--accent); font-weight: bold; }
      .gauge-content ha-icon { margin-top: 15px; opacity: 0.3; }

      .live-graph-area { margin-top: 40px; }
      .graph-header { display: flex; justify-content: space-between; font-size: 0.8em; margin-bottom: 10px; color: #aaa; }
      .graph-header .sub { color: #555; display: flex; align-items: center; gap: 5px; }
      .graph-canvas { position: relative; height: 100px; background: rgba(0,0,0,0.2); border-radius: 12px; border: 1px solid var(--border-glass); overflow: hidden; }
      .graph-line { stroke: var(--accent); stroke-width: 2; }
      .graph-area { fill: linear-gradient(to bottom, rgba(247, 147, 26, 0.2), transparent); }
      .graph-axes { position: absolute; right: 10px; top: 5px; bottom: 5px; display: flex; flex-direction: column; justify-content: space-between; font-size: 0.6em; color: #444; }

      .stats-stack { display: flex; flex-direction: column; gap: 20px; }
      .stat-card { padding: 20px; }
      .stat-header { font-size: 0.75em; font-weight: bold; color: #888; margin-bottom: 20px; letter-spacing: 1px; }
      .stat-body { display: flex; align-items: center; gap: 20px; }
      .stat-icon-box { 
        width: 60px; height: 60px; 
        background: rgba(255,255,255,0.03); 
        border-radius: 12px; 
        display: flex; align-items: center; justify-content: center; 
        border: 1px solid var(--border-glass);
      }
      .stat-icon-box.orange { color: var(--accent); border-color: rgba(247, 147, 26, 0.3); }
      .stat-details { flex: 1; }
      .detail-row { display: flex; justify-content: space-between; font-size: 0.8em; margin-bottom: 5px; }
      .detail-row span:last-child { font-weight: bold; color: #fff; }
      .status.online { color: #2ecc71 !important; font-size: 0.9em; }

      .settings-container { max-width: 800px; margin: 0 auto; }
      .section-header { font-size: 1em; font-weight: bold; color: var(--accent); margin-bottom: 25px; }
      .settings-row { display: flex; justify-content: space-between; align-items: center; padding: 20px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
      .info .label { font-size: 1.1em; margin-bottom: 5px; }
      .info .desc { font-size: 0.8em; color: #666; }
      .btn-save { 
        width: 100%; margin-top: 30px; padding: 18px; 
        background: var(--accent); border: none; border-radius: 12px; 
        color: #fff; font-weight: bold; cursor: pointer; transition: 0.3s;
      }
      .btn-save:hover { background: #ffaa33; }
    `;
  }
}
customElements.define("hoymiles-cyd-panel", HoymilesCYDPanel);
