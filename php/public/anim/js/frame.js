/* Gemeinsames Hilfsskript der Animationsseiten unter anim/:
   1. Text-Ein/Ausblenden der Bildunterschrift (.capbtn).
   2. Meldet der einbettenden Übungsseite (uebung.php, gleicher Ursprung) die eigene Höhe,
      damit das iframe ohne inneren Scrollbalken genau so hoch wird wie sein Inhalt. */
(function () {
  document.querySelectorAll('.capbtn').forEach(function (b) {
    b.addEventListener('click', function () {
      var c = b.closest('.vcap'), closed = c.classList.toggle('closed');
      b.textContent = closed ? 'Text zeigen' : 'Text ausblenden';
      b.setAttribute('aria-expanded', String(!closed));
    });
  });

  if (window.parent === window) return;
  var last = 0;
  function post() {
    var h = Math.ceil(document.documentElement.getBoundingClientRect().height);
    if (h === last) return;
    last = h;
    window.parent.postMessage({ type: 'lab-frame-height', h: h }, window.location.origin);
  }
  new ResizeObserver(post).observe(document.documentElement);
  window.addEventListener('load', post);
  post();
})();
