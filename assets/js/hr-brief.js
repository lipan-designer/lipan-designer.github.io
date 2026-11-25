(() => {
  const example = document.querySelector('[data-roster-example]');
  if (!example) return;

  const controls = example.querySelector('.hb-switch');
  const buttons = Array.from(controls.querySelectorAll('button[aria-controls]'));
  const figures = buttons.map(button => document.getElementById(button.getAttribute('aria-controls')));
  if (figures.some(figure => !example.contains(figure))) return;

  function show(index) {
    buttons.forEach((button, position) => {
      const active = index === position;
      button.setAttribute('aria-pressed', String(active));
      figures[position].hidden = !active;
    });
  }

  buttons.forEach((button, index) => button.addEventListener('click', () => show(index)));
  show(0);
  controls.hidden = false;
})();
