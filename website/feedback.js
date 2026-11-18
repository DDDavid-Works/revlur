// Feedback form via Web3Forms (https://web3forms.com), sent straight from the page (no third-party
// script). Same public access key as the old waitlist: it can only send to the owner's inbox.
// Spam guard: the hidden "company" honeypot plus Web3Forms' own server-side checks.
const ENDPOINT = 'https://api.web3forms.com/submit';
const ACCESS_KEY = 'b3ed5eae-3d96-4184-9e54-de87d5e66788';

// Opened by Chrome after the extension is removed (setUninstallURL adds ?uninstalled).
const uninstalled = new URLSearchParams(location.search).has('uninstalled');
if (uninstalled) {
  document.getElementById('fb-title').textContent = 'Sorry to see you go.';
  document.getElementById('fb-lead').textContent =
    'Revlur has been removed. If you have a moment, one line on why would help a lot: what was missing, what got in the way, or where it didn’t work.';
  document.getElementById('fb-review').hidden = true;
}

const form = document.querySelector('form[data-feedback]');
if (form) {
  const message = form.elements.message;
  const email = form.elements.email;
  const btn = form.querySelector('button');
  const msg = form.querySelector('.wl-msg');
  const say = (text, kind) => { msg.textContent = text; msg.className = 'wl-msg' + (kind ? ' ' + kind : ''); };
  const thanks = 'Thanks! Your message is on its way.';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form.elements.company.value) return say(thanks, 'ok'); // honeypot: bots fill this
    if (!message.value.trim()) return say('Please write a few words first.', 'err');
    if (email.value.trim() && !email.checkValidity()) return say('That email address doesn’t look right. You can also leave it empty.', 'err');
    btn.disabled = true;
    say('Sending...');
    const source = uninstalled ? 'uninstall' : 'website';
    const body = {
      access_key: ACCESS_KEY,
      subject: uninstalled ? 'Revlur feedback (after uninstall)' : 'Revlur feedback',
      from_name: 'Revlur feedback',
      source,
      message: message.value.trim(),
    };
    if (email.value.trim()) body.email = email.value.trim(); // becomes the reply-to address
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || String(res.status));
      form.reset();
      say(thanks, 'ok');
    } catch {
      say('Something went wrong. Please try again, or use the email address below.', 'err');
    } finally {
      btn.disabled = false;
    }
  });
}
