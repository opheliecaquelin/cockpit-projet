const d = $$('main input[type=date]').find(e => e.value === '2027-01-11');
if (d) { saisir(d, '2027-01-25'); await w(500); }
const R = $('main').innerText.match(/R2[\s\S]{0,80}/)?.[0];
