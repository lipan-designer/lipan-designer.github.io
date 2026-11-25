(() => {
  const gallery = document.getElementById('comparison-gallery');
  if (!gallery) return;

  const tablist = gallery.querySelector('.ir-tabs');
  const tabs = Array.from(tablist.querySelectorAll('button[aria-controls]'));
  const panels = tabs.map(tab => document.getElementById(tab.getAttribute('aria-controls')));

  function select(index) {
    tabs.forEach((tab, position) => {
      const selected = position === index;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      panels[position].hidden = !selected;
    });
  }

  tablist.setAttribute('role', 'tablist');
  tabs.forEach((tab, index) => {
    const panel = panels[index];
    tab.setAttribute('role', 'tab');
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    panel.tabIndex = 0;
    tab.addEventListener('click', () => select(index));
    tab.addEventListener('keydown', event => {
      let next = index;
      switch (event.key) {
        case 'ArrowRight': next = (index + 1) % tabs.length; break;
        case 'ArrowLeft': next = (index + tabs.length - 1) % tabs.length; break;
        case 'Home': next = 0; break;
        case 'End': next = tabs.length - 1; break;
        default: return;
      }
      event.preventDefault();
      select(next);
      tabs[next].focus();
    });
  });

  const linkedPanel = panels.findIndex(panel => `#${panel.id}` === location.hash);
  select(linkedPanel >= 0 ? linkedPanel : 0);
  tablist.hidden = false;
})();
