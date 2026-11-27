await w(1500); window.confirm = () => true;
const out = { erreurs: [] }; window.addEventListener('error', e => out.erreurs.push(e.message));
const s = $('#projSel'); s.value = [...s.options].find(o => o.textContent.includes('Signature')).value; s.dispatchEvent(new Event('change', { bubbles: true })); await w(800);
await clic('[data-act=module][data-id=instances]', 500);
if ($('[data-act=cr-retour]')) await clic('[data-act=cr-retour]', 400);
const carteDe = txt => $$('.inst-card[data-act=cr-ouvrir]').find(c => c.textContent.includes(txt));
const boutons = c => [...c.querySelectorAll('button')].map(b => b.textContent.trim());
out.carteCopil = boutons(carteDe('Copil'));
out.carteEntretien = boutons(carteDe('n°3'));
const etat = () => [$$('.re-pas').map(x => x.className.replace('re-pas', '').trim() + ':' + x.querySelector('b').textContent), $$('.re-actions button, .re-actions .link, .re-actions .muted').map(x => x.textContent.trim())];
// réunion à venir
await clic(carteDe('n°3'), 600); if ($('.re-actions .link[data-act=cr-preparee]')) await clic('.re-actions .link[data-act=cr-preparee]', 600); out.futur0 = etat();
await clic('.re-actions button[data-act=cr-preparee]', 600); out.futur1 = etat();
await clic('.re-actions .link[data-act=cr-preparee]', 600); out.futurRetour = etat();
// réunion passée non réalisée ?
await clic('[data-act=cr-retour]', 400);
const passee = $$('.inst-card[data-act=cr-ouvrir]').find(c => /CR à rédiger|CR à finaliser/.test(c.textContent));
if (passee) { await clic(passee, 600); out.passe0 = etat(); await clic('.re-actions [data-act=cr-diffuse]', 600); out.passe2 = etat(); await clic('.re-actions .link[data-act=cr-diffuse]', 600); out.passeRetour = etat(); await clic('[data-act=cr-retour]', 400); }
// copil : bouton principal, puis lien vers la fiche
await clic(carteDe('Copil').querySelector('[data-act=in-prep]'), 600);
out.prepCopil = [$('#subtabs .subtab.active')?.textContent.trim(), !!$('main [data-act=cr-ouvrir]')];
await clic('main [data-act=cr-ouvrir]', 700);
out.ficheCopil = [$('#subtabs .subtab.active')?.textContent.trim(), $('main h2')?.textContent.trim(), etat()[0]];
// clic sur la carte du copil : ouvre la fiche
await clic('[data-act=cr-retour]', 400); await clic(carteDe('Copil'), 600); out.clicCarte = $('main h2')?.textContent.trim();
await clic(carteDe ? '[data-act=cr-retour]' : 'body', 300);
await clic(carteDe('n°3'), 600); window.scrollTo(0, 0);
return out;
