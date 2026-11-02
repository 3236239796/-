const formatTime = (seconds) => {
  const total = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

export class GameUI {
  constructor(root, actions) {
    this.root = root;
    this.actions = actions;
    this.root.innerHTML = `
      <div class="game-ui">
        <section class="screen menu-screen" id="menu-screen" aria-label="主菜单">
          <div class="menu-backdrop"></div>
          <div class="menu-top"><span class="brand-mark">N<span>//</span>A</span><span class="menu-build">FIELD OPERATION / 09.01</span><span class="menu-signal"><i></i> SIGNAL STABLE</span></div>
          <div class="menu-content">
            <div class="eyebrow"><span class="eyebrow-line"></span> A SCI-FI ACTION ROGUELITE <span class="eyebrow-line"></span></div>
            <h1>NULL<span>//</span><br><em>ASCENT</em></h1>
            <p class="menu-subtitle">裂隙远征 · THE LAST SIGNAL</p>
            <p class="menu-copy">巨构正在坍塌。深入裂隙，夺回失落的回响。<br>每一次选择，都会改变你活下来的方式。</p>
            <button class="primary-button" id="start-run" data-testid="start-run"><span>开始远征</span><b>↗</b></button>
            <div class="menu-meta"><span>WASD 移动</span><span>鼠标瞄准 / 射击</span><span>SHIFT 相位冲刺</span><span>E 裂隙脉冲</span></div>
          </div>
          <div class="menu-bottom"><span>SECTOR 09 · THE SUNKEN CATHEDRAL</span><span>WEBGPU FIRST / WEBGL2 FALLBACK</span><span id="menu-best">BEST RUN —</span></div>
          <div class="menu-vertical">INTO THE BREACH / NO RETURN</div>
        </section>

        <section class="hud-layer hidden" id="hud-layer" data-testid="game-hud" aria-label="战斗界面">
          <header class="hud-top">
            <div class="hud-panel player-panel">
              <div class="hud-label">BREACH RUNNER <span id="player-status">ONLINE</span></div>
              <div class="resource-line"><span class="resource-name">INTEGRITY</span><strong id="hp-value">120 / 120</strong></div>
              <div class="meter"><i id="hp-meter"></i></div>
              <div class="resource-line compact"><span class="resource-name">AEGIS SHIELD</span><strong id="shield-value">35 / 35</strong></div>
              <div class="meter shield-meter"><i id="shield-meter"></i></div>
            </div>
            <div class="hud-center">
              <div class="sector-kicker">INCursion <span>09</span></div>
              <div class="sector-name" id="run-state" data-testid="run-state">战区 01 <small>THE OUTER RING</small></div>
              <div class="wave-progress"><i id="wave-meter"></i></div>
              <div class="sector-foot"><span id="wave-objective">清除裂隙回声</span><span id="run-time">00:00</span></div>
            </div>
            <div class="hud-panel score-panel">
              <div class="hud-label">COMBAT RECORD <span id="renderer-status">RENDERING</span></div>
              <div class="score-main"><strong id="kill-value">000</strong><span>ELIMINATED</span></div>
              <div class="score-sub"><span>COMBO <b id="combo-value">x0</b></span><span>LEVEL <b id="level-value">01</b></span></div>
              <button class="icon-button" id="pause-button" aria-label="暂停" title="暂停 (P / Esc)">Ⅱ</button>
            </div>
          </header>
          <div class="hud-bottom">
            <div class="build-panel hud-panel">
              <div class="hud-label">ACTIVE CONFIGURATION</div>
              <div class="build-title" id="build-title">PRISM REPEATER <span>MK.I</span></div>
              <div class="build-tags" id="build-tags"><i>PRISM</i><i>PHASE</i></div>
              <div class="xp-line"><span>RESONANCE</span><b id="xp-value">0 / 14</b></div>
              <div class="meter xp-meter"><i id="xp-meter"></i></div>
            </div>
            <div class="ability-panel">
              <div class="ability-card" id="dash-card"><span class="ability-key">SHIFT</span><span class="ability-name">PHASE DASH</span><div class="ability-cooldown" id="dash-cooldown">READY</div></div>
              <div class="ability-card special-card" id="special-card"><span class="ability-key">E</span><span class="ability-name">RIFT PULSE</span><div class="special-meter"><i id="special-meter"></i></div><div class="ability-cooldown" id="special-charge">35%</div></div>
            </div>
            <div class="boss-panel hud-panel hidden" id="boss-panel">
              <div class="hud-label">ANOMALOUS SIGNATURE <span id="boss-phase">PHASE I</span></div>
              <div class="boss-name" id="boss-name">THE CHOIR</div>
              <div class="meter boss-meter"><i id="boss-meter"></i></div>
              <div class="boss-foot"><span>HOSTILE CORE</span><b id="boss-health">100%</b></div>
            </div>
          </div>
          <div class="combat-toast" id="combat-toast" aria-live="polite"></div>
        </section>

        <section class="overlay hidden" id="upgrade-screen">
          <div class="modal-shell upgrade-shell" role="dialog" aria-modal="true" aria-label="选择强化">
            <div class="modal-kicker">RESONANCE SYNCHRONIZED / NEW MODULES</div>
            <div class="modal-title">选择你的进化</div>
            <p class="modal-copy">裂隙正在重写你的战斗协议。选择一个模块，构筑你的生存方式。</p>
            <div class="upgrade-grid" id="upgrade-grid"></div>
            <div class="modal-foot">选择后继续战斗 <span>ONE MODULE / NO REFUNDS</span></div>
          </div>
        </section>

        <section class="overlay hidden" id="pause-screen">
          <div class="modal-shell pause-shell" role="dialog" aria-modal="true" aria-label="暂停">
            <div class="modal-kicker">COMBAT SUSPENDED</div>
            <div class="modal-title">行动暂停</div>
            <p class="modal-copy">裂隙仍在扩张，但时间暂时停下了。</p>
            <div class="pause-stats" id="pause-stats"></div>
            <div class="pause-actions">
              <button class="primary-button" id="resume-button"><span>继续</span><b>↗</b></button>
              <button class="secondary-button" id="settings-button">设置 / SETTINGS</button>
              <button class="text-button" id="abandon-button">放弃本次远征</button>
            </div>
          </div>
        </section>

        <section class="overlay hidden" id="settings-screen">
          <div class="modal-shell settings-shell" role="dialog" aria-modal="true" aria-label="设置">
            <div class="modal-kicker">SYSTEM CONFIGURATION</div>
            <div class="modal-title">系统设置</div>
            <label class="setting-row"><span><b>音频总音量</b><small>MASTER OUTPUT</small></span><input id="volume-setting" type="range" min="0" max="1" step="0.05" value="0.72"></label>
            <label class="setting-row"><span><b>音乐</b><small>AMBIENT SCORE</small></span><input id="music-setting" type="checkbox" checked></label>
            <label class="setting-row"><span><b>战斗音效</b><small>COMBAT FEEDBACK</small></span><input id="sfx-setting" type="checkbox" checked></label>
            <label class="setting-row"><span><b>画面质量</b><small>RENDER QUALITY</small></span><select id="quality-setting"><option value="high">高 / HIGH</option><option value="medium">中 / MEDIUM</option><option value="low">性能 / PERFORMANCE</option></select></label>
            <button class="primary-button" id="settings-back"><span>返回</span><b>↗</b></button>
          </div>
        </section>

        <section class="overlay hidden" id="result-screen">
          <div class="modal-shell result-shell" role="dialog" aria-modal="true" aria-label="远征结算">
            <div class="modal-kicker" id="result-kicker">SIGNAL ARCHIVED</div>
            <div class="result-title" id="result-title">BREACH SEALED</div>
            <p class="modal-copy" id="result-copy"></p>
            <div class="result-stats" id="result-stats"></div>
            <div class="result-build" id="result-build"></div>
            <div class="result-actions"><button class="primary-button" id="restart-button"><span>再次远征</span><b>↗</b></button><button class="secondary-button" id="menu-button">返回主菜单</button></div>
          </div>
        </section>
        <div class="renderer-badge" id="renderer-badge">INITIALIZING RENDERER</div>
      </div>
    `;
    this.el = Object.fromEntries(['menu-screen','hud-layer','upgrade-screen','pause-screen','settings-screen','result-screen','start-run','pause-button','resume-button','settings-button','abandon-button','settings-back','restart-button','menu-button','upgrade-grid','combat-toast','renderer-badge','boss-panel','volume-setting','music-setting','sfx-setting','quality-setting'].map(id => [id, this.root.querySelector(`#${id}`)]));
    this.el['start-run'].addEventListener('click', () => this.actions.start());
    this.el['pause-button'].addEventListener('click', () => this.actions.pause());
    this.el['resume-button'].addEventListener('click', () => this.actions.resume());
    this.el['settings-button'].addEventListener('click', () => this.showSettings());
    this.el['settings-back'].addEventListener('click', () => this.showPause());
    this.el['abandon-button'].addEventListener('click', () => this.actions.abandon());
    this.el['restart-button'].addEventListener('click', () => this.actions.restart());
    this.el['menu-button'].addEventListener('click', () => this.actions.menu());
    this.el['volume-setting'].addEventListener('input', event => this.actions.volume(Number(event.target.value)));
    this.el['music-setting'].addEventListener('change', event => this.actions.music(event.target.checked));
    this.el['sfx-setting'].addEventListener('change', event => this.actions.sfx(event.target.checked));
    this.el['quality-setting'].addEventListener('change', event => this.actions.quality(event.target.value));
  }

  hideAll() {
    ['menu-screen','hud-layer','upgrade-screen','pause-screen','settings-screen','result-screen'].forEach(id => this.root.querySelector(`#${id}`).classList.add('hidden'));
  }

  showMenu(best = null) {
    this.hideAll();
    this.el['menu-screen'].classList.remove('hidden');
    this.root.querySelector('#menu-best').textContent = best ? `BEST ${best.wave} / ${formatTime(best.time)}` : 'BEST RUN —';
  }

  showGame() {
    this.hideAll();
    this.el['hud-layer'].classList.remove('hidden');
  }

  showPause(stats = {}) {
    this.hideAll();
    this.el['hud-layer'].classList.remove('hidden');
    this.el['pause-screen'].classList.remove('hidden');
    this.root.querySelector('#pause-stats').innerHTML = `<span><b>${String(stats.wave ?? 1).padStart(2,'0')}</b><small>SECTOR</small></span><span><b>${stats.kills ?? 0}</b><small>ELIMINATIONS</small></span><span><b>${formatTime(stats.time ?? 0)}</b><small>TIME</small></span>`;
  }

  showSettings() {
    this.el['pause-screen'].classList.add('hidden');
    this.el['settings-screen'].classList.remove('hidden');
  }

  showUpgrade(choices, onSelect) {
    this.el['upgrade-grid'].replaceChildren();
    for (const [index, choice] of choices.entries()) {
      const button = document.createElement('button');
      button.className = `upgrade-card rarity-${choice.rarity ?? 'common'}`;
      button.dataset.upgrade = choice.id;
      button.innerHTML = `<span class="upgrade-index">0${index + 1} / ${(choice.rarity ?? 'common').toUpperCase()}</span><span class="upgrade-icon">${['◈','⌁','⟡'][index]}</span><b>${choice.name}</b><p>${choice.description}</p><span class="upgrade-tags">${(choice.tags ?? []).map(tag => `<i>${tag.toUpperCase()}</i>`).join('')}</span><span class="upgrade-pick">INSTALL MODULE ↗</span>`;
      button.addEventListener('click', () => onSelect(choice));
      this.el['upgrade-grid'].append(button);
    }
    this.el['upgrade-screen'].classList.remove('hidden');
  }

  hideUpgrade() { this.el['upgrade-screen'].classList.add('hidden'); }

  update(state, rendererName) {
    const player = state.player;
    const progress = state.progress;
    const setText = (id, value) => { const element = this.root.querySelector(`#${id}`); if (element) element.textContent = value; };
    const setWidth = (id, value) => { const element = this.root.querySelector(`#${id}`); if (element) element.style.width = `${Math.max(0,Math.min(100,value))}%`; };
    setText('hp-value', `${Math.ceil(player.hp)} / ${player.maxHp}`);
    setWidth('hp-meter', player.hp / player.maxHp * 100);
    setText('shield-value', `${Math.ceil(player.shield)} / ${player.maxShield}`);
    setWidth('shield-meter', player.maxShield ? player.shield / player.maxShield * 100 : 0);
    setText('kill-value', String(progress.kills).padStart(3, '0'));
    setText('combo-value', `x${progress.combo}`);
    setText('level-value', String(progress.level).padStart(2, '0'));
    setText('run-time', formatTime(progress.elapsed));
    setText('run-state', `战区 ${String(progress.wave).padStart(2,'0')}`);
    setWidth('wave-meter', progress.sectorTime / 60 * 100);
    setText('xp-value', `${Math.floor(progress.xp)} / ${progress.xpToNext}`);
    setWidth('xp-meter', progress.xp / progress.xpToNext * 100);
    setText('build-title', `PRISM REPEATER · ${state.build.upgrades.length} MODULES`);
    const tags = Object.entries(state.build.tags).filter(([,count]) => count > 0).map(([tag,count]) => `<i class="${count >= 3 ? 'active' : ''}">${tag.toUpperCase()} ${count}</i>`).join('');
    this.root.querySelector('#build-tags').innerHTML = tags || '<i>PRISM</i>';
    setText('dash-cooldown', state.cooldowns.dash <= 0 ? 'READY' : `${state.cooldowns.dash.toFixed(1)}s`);
    setText('special-charge', `${Math.floor(player.specialCharge)}%`);
    setWidth('special-meter', player.specialCharge);
    setText('renderer-status', rendererName);
    setText('renderer-badge', rendererName);
    setText('wave-objective', state.boss ? '击破异常核心' : '清除裂隙回声');
    if (state.boss) {
      this.el['boss-panel'].classList.remove('hidden');
      setText('boss-name', state.boss.name);
      setText('boss-phase', state.boss.phaseLabel);
      setText('boss-health', `${Math.ceil(state.boss.hp / state.boss.maxHp * 100)}%`);
      setWidth('boss-meter', state.boss.hp / state.boss.maxHp * 100);
    } else {
      this.el['boss-panel'].classList.add('hidden');
    }
  }

  toast(message, kind = 'normal') {
    const element = this.el['combat-toast'];
    element.textContent = message;
    element.dataset.kind = kind;
    element.classList.add('visible');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => element.classList.remove('visible'), 1700);
  }

  showResult(result, onRestart) {
    this.hideAll();
    this.el['result-screen'].classList.remove('hidden');
    const won = result.won;
    this.root.querySelector('#result-kicker').textContent = won ? 'SIGNAL ARCHIVED / BREACH SEALED' : 'SIGNAL LOST / CORE FAILURE';
    this.root.querySelector('#result-title').textContent = won ? '裂隙已封' : '远征中断';
    this.root.querySelector('#result-copy').textContent = won ? '你切断了回声之源。巨构暂时停止坍塌。' : '核心信号消失。裂隙仍在扩张。';
    this.root.querySelector('#result-stats').innerHTML = [
      ['战区', `${result.wave} / 05`], ['击杀', result.kills], ['用时', formatTime(result.time)], ['等级', result.level], ['最高连击', result.combo], ['伤害输出', Math.floor(result.damage)]
    ].map(([label,value]) => `<div><small>${label}</small><b>${value}</b></div>`).join('');
    this.root.querySelector('#result-build').textContent = result.build.length ? `本局构筑：${result.build.join(' · ')}` : '本局未安装强化模块';
  }

  setQuality(value) { this.el['quality-setting'].value = value; }
}
