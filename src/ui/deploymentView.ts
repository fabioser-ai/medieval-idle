import {
  EXPERIENCE_TIERS,
  FORMATION_SLOTS,
  UNIT_TYPES,
  type UnitType,
} from '../domain/army';
import {
  BattleController,
  DEFAULT_PLAYBACK_SPEED,
  type BattleRenderer,
} from './controls';
import { DeploymentEditor, slotLabel } from './deployment';
import { Campaign } from '../application/campaign';
import {
  developerScenarios,
  type AcceptanceScenario,
} from '../game/acceptanceScenarios';
import { demoArmies } from '../game/demoBattle';

interface DeploymentRenderer extends BattleRenderer {
  setBattleFinishedHandler(handler: () => void): void;
  setBattleResultHandler?(handler: () => void): void;
}
interface DeploymentOptions {
  campaign?: Campaign;
  preset?: AcceptanceScenario;
  developer?: boolean;
  prefill?: boolean;
  focusOnMount?: boolean;
}

export function mountDeployment(
  host: HTMLElement,
  renderer: DeploymentRenderer,
  options: DeploymentOptions = {},
): void {
  const campaign = options.campaign ?? new Campaign();
  const preset = options.preset;
  const doc = host.ownerDocument;
  const element = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    text = '',
    className = '',
  ): HTMLElementTagNameMap[K] => {
    const node = doc.createElement(tag);
    node.textContent = text;
    node.className = className;
    return node;
  };
  const editor = new DeploymentEditor(campaign.inventory, 240);
  const controller = new BattleController(editor, renderer, {
    campaign,
    enemy: preset?.right,
    seed: preset?.seed,
  });
  const preparation = element('section', '', 'deployment');
  preparation.setAttribute('aria-label', 'Deploy your army');
  preparation.append(
    element('h2', 'Deploy your army'),
    element(
      'p',
      'Choose a formation, quantity and experience mix. Percentages total 100%; zero quantity leaves a position empty.',
      'intro',
    ),
  );
  const enemy = preset?.right ?? demoArmies()[1];
  preparation.append(
    element(
      'p',
      `You command Alderwatch (blue, left). Fixed opponent: Emberfall (red, right) — ${enemy.groups.flatMap((g) => g.cohorts.map((c) => `${c.count} ${c.tier} ${c.type} (${slotLabel(g.slot)})`)).join('; ')}. Seed ${preset?.seed ?? 626}.`,
      'intro',
    ),
  );
  const inventory = element('div', '', 'inventory');
  const inventoryRows = UNIT_TYPES.map((type) => {
    const row = element('p');
    row.id = `inventory-${type}`;
    inventory.append(row);
    return row;
  });
  preparation.append(element('h3', 'Remaining troops'), inventory);
  const formations = element('div', '', 'formations');
  const status = element('p', '', 'status');
  status.id = 'deployment-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  const start = element('button', 'To Battle', 'start');
  start.type = 'button';
  start.setAttribute('aria-describedby', status.id);
  const fields: (HTMLInputElement | HTMLSelectElement)[] = [];
  const detachListeners: (() => void)[] = [];
  let developerSummary: HTMLElement | undefined;
  const listen = (target: HTMLElement, event: string, handler: () => void) => {
    target.addEventListener(event, handler);
    detachListeners.push(() => target.removeEventListener(event, handler));
  };
  const remount = (next: DeploymentOptions) => {
    for (const detach of detachListeners) detach();
    mountDeployment(host, renderer, { ...options, ...next, campaign });
  };
  if (campaign.depleted) {
    const restart = element('button', 'Start new campaign');
    restart.type = 'button';
    const confirmation = element('section', '', 'campaign-confirmation');
    confirmation.hidden = true;
    confirmation.setAttribute('aria-label', 'Confirm campaign replacement');
    const confirm = element('button', 'Confirm new campaign');
    const cancel = element('button', 'Cancel');
    confirm.type = cancel.type = 'button';
    confirmation.append(
      element(
        'p',
        'Replace this depleted campaign and its last result with the initial prototype roster? This starts a new campaign; fallen troops are not revived.',
      ),
      confirm,
      cancel,
    );
    listen(restart, 'click', () => {
      confirmation.hidden = false;
      restart.hidden = true;
      cancel.focus();
    });
    listen(cancel, 'click', () => {
      confirmation.hidden = true;
      restart.hidden = false;
      restart.focus();
    });
    listen(confirm, 'click', () => {
      campaign.startNewCampaign();
      remount({ preset: undefined, prefill: false, focusOnMount: true });
    });
    preparation.append(
      element('p', 'No troops remain in this campaign.', 'intro'),
      restart,
      confirmation,
    );
  }
  if (options.developer) {
    const details = element('details');
    developerSummary = element('summary', 'Developer acceptance presets');
    details.append(developerSummary);
    const select = element('select');
    select.setAttribute('aria-label', 'Acceptance preset');
    const blank = element(
      'option',
      'Choose a preset (replaces campaign roster)',
    );
    blank.value = '';
    select.append(blank);
    for (const scenario of developerScenarios) {
      const option = element('option', scenario.label);
      option.value = scenario.id;
      select.append(option);
    }
    // This is a reset action, not persistent selection: the same scenario can
    // be selected again after its roster has been depleted.
    select.value = '';
    listen(select, 'change', () => {
      const selected = developerScenarios.find((s) => s.id === select.value);
      if (!selected) return;
      campaign.reset(selected.left);
      remount({ preset: selected, prefill: true });
    });
    fields.push(select);
    details.append(select);
    preparation.append(details);
  }
  const lastResult = element('p', '', 'intro');
  lastResult.id = 'last-result';
  const updateResult = () => {
    const r = campaign.data.lastResult;
    lastResult.textContent = r
      ? `Last result: ${r.outcome} · ${r.winner ?? 'neither'} wins · survivors left ${r.leftSurvivors} · right ${r.rightSurvivors} · seed ${campaign.data.lastSeed}. ${campaign.notice}`
      : `No completed battle. ${campaign.notice}`;
  };
  const refresh = () => {
    start.disabled = !editor.canStartBattle;
    status.textContent =
      editor.validationMessage ||
      'Ready. Your formation will lock when battle begins.';
    UNIT_TYPES.forEach((type, index) => {
      inventoryRows[index].textContent =
        `${type[0].toUpperCase() + type.slice(1)} · ${EXPERIENCE_TIERS.map((tier) => `${tier[0].toUpperCase() + tier.slice(1)} ${editor.remaining(type, tier)}`).join(' · ')}`;
    });
  };
  for (const slot of FORMATION_SLOTS) {
    const initial =
      options.prefill !== false
        ? preset?.left.groups.find((g) => g.slot === slot)?.cohorts[0]
        : undefined;
    const title = slotLabel(slot);
    const group = element('fieldset', '', `formation formation-${slot}`);
    group.append(element('legend', title));
    const type = element('select');
    type.setAttribute('aria-label', `${title} unit type`);
    for (const unitType of UNIT_TYPES) {
      const option = element(
        'option',
        unitType[0].toUpperCase() + unitType.slice(1),
      );
      option.value = unitType;
      type.append(option);
    }
    type.value = initial?.type ?? 'infantry';
    const typeLabel = element('label', 'Unit type');
    typeLabel.append(type);
    group.append(typeLabel);
    fields.push(type);
    const numeric = (label: string, value: number, max?: number) => {
      const input = element('input');
      input.type = 'number';
      input.min = '0';
      input.step = '1';
      input.value = String(value);
      if (max !== undefined) input.max = String(max);
      input.setAttribute('aria-label', `${title} ${label}`);
      input.setAttribute('aria-describedby', status.id);
      const wrapper = element('label', label);
      wrapper.append(input);
      fields.push(input);
      return { input, wrapper };
    };
    const quantity = numeric('quantity', initial?.count ?? 0);
    group.append(quantity.wrapper);
    const mix = element('div', '', 'experience-mix');
    const ratios = EXPERIENCE_TIERS.map((tier, index) => {
      const item = numeric(
        `${tier} %`,
        initial ? (tier === initial.tier ? 100 : 0) : index === 0 ? 100 : 0,
        100,
      );
      mix.append(item.wrapper);
      return item.input;
    });
    group.append(mix);
    const update = () => {
      editor.setRatios(
        slot,
        type.value as UnitType,
        quantity.input.value === '' ? NaN : Number(quantity.input.value),
        ratios.map((input) => (input.value === '' ? NaN : Number(input.value))),
      );
      refresh();
    };
    listen(type, 'change', update);
    for (const input of [quantity.input, ...ratios])
      listen(input, 'input', update);
    if (initial) update();
    formations.append(group);
  }
  preparation.append(
    formations,
    element(
      'p',
      'Rounding: largest fractional share wins each spare troop; ties favor recruit, trained, veteran, then elite.',
      'rounding-note',
    ),
  );
  const viewing = element('nav', '', 'viewing-controls');
  viewing.hidden = true;
  viewing.setAttribute('aria-label', 'Battle playback');
  const buttons = ([0, 1, 2, 4] as const).map((speed) => {
    const button = element('button', speed === 0 ? 'Pause' : `${speed}×`);
    button.type = 'button';
    button.setAttribute(
      'aria-pressed',
      String(speed === DEFAULT_PLAYBACK_SPEED),
    );
    listen(button, 'click', () => {
      controller.viewing.setPlaybackSpeed(speed);
      buttons.forEach((other, index) =>
        other.setAttribute(
          'aria-pressed',
          String([0, 1, 2, 4][index] === speed),
        ),
      );
      status.textContent =
        speed === 0
          ? 'Paused. Choose a speed to resume.'
          : `Viewing at ${speed}×. Strategy locked.`;
    });
    viewing.append(button);
    return button;
  });
  preparation.append(start);
  listen(start, 'click', () => {
    if (!editor.canStartBattle) {
      refresh();
      return;
    }
    controller.start();
    for (const field of fields) field.disabled = true;
    start.disabled = true;
    preparation.hidden = true;
    viewing.hidden = false;
    host.className = 'battle-ui viewing';
    status.textContent = `Viewing at ${DEFAULT_PLAYBACK_SPEED}×. Strategy locked.`;
    buttons[0].focus();
  });
  host.className = 'battle-ui';
  host.replaceChildren(preparation, status, viewing, lastResult);
  refresh();
  updateResult();
  renderer.setBattleResultHandler?.(() => {
    campaign.finish();
    updateResult();
  });
  // One replaceable scene callback, never one listener per frame or per phase.
  renderer.setBattleFinishedHandler(() => {
    campaign.finish();
    remount({ prefill: false, focusOnMount: true });
  });
  if (options.focusOnMount) (developerSummary ?? fields[0])?.focus();
}
