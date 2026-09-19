import {
  EXPERIENCE_TIERS,
  FORMATION_SLOTS,
  UNIT_TYPES,
  type UnitType,
} from '../domain/army';
import { BattleController, type BattleRenderer } from './controls';
import { DeploymentEditor, slotLabel, type Inventory } from './deployment';

/** Deliberately bounded at 120 troops: maximum-size synchronous simulation is not UI-safe. */
const prototypeInventory: Inventory = Object.fromEntries(
  UNIT_TYPES.map((type) => [
    type,
    { recruit: 12, trained: 10, veteran: 6, elite: 2 },
  ]),
);

export function mountDeployment(
  host: HTMLElement,
  renderer: BattleRenderer,
): void {
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
  const editor = new DeploymentEditor(prototypeInventory);
  const controller = new BattleController(editor, renderer);
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
    type.value = 'infantry';
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
    const quantity = numeric('quantity', 0);
    group.append(quantity.wrapper);
    const mix = element('div', '', 'experience-mix');
    const ratios = EXPERIENCE_TIERS.map((tier, index) => {
      const item = numeric(`${tier} %`, index === 0 ? 100 : 0, 100);
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
    type.addEventListener('change', update);
    for (const input of [quantity.input, ...ratios])
      input.addEventListener('input', update);
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
    button.setAttribute('aria-pressed', String(speed === 1));
    button.addEventListener('click', () => {
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
  start.addEventListener('click', () => {
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
    status.textContent = 'Viewing at 1×. Strategy locked.';
    buttons[0].focus();
  });
  host.className = 'battle-ui';
  host.append(preparation, status, viewing);
  refresh();
}
