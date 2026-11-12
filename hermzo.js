// hermzo.js — quote and booking form on hermzo.com
(function () {
  var API = (window.HERMZO_API || 'https://api.hermzo.com') + '/hermzo';
  var $ = function (id) { return document.getElementById(id); };
  var state = { size: null, speed: 'asap', quote: null };
  var money = function (c) { return '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  $('yr').textContent = new Date().getFullYear();

  function post(path, body) {
    return fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j._ok = r.ok; return j; }); })
      .catch(function () { return { _ok: false, error: 'Couldn’t reach Hermzo. Check your connection and try again.' }; });
  }

  // open cities line
  fetch(API + '/cities').then(function (r) { return r.json(); }).then(function (j) {
    if (j.cities && j.cities.length) $('cityLine').textContent = 'Now serving ' + j.cities.map(function (c) { return c.name; }).join(', ').replace(/, ([^,]*)$/, ' and $1') + '.';
  }).catch(function () {});

  function pick(groupId, attr, val) {
    Array.prototype.forEach.call($(groupId).querySelectorAll('[data-' + attr + ']'), function (b) {
      var on = b.getAttribute('data-' + attr) === val;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  $('sizes').addEventListener('click', function (e) {
    var b = e.target.closest('[data-size]'); if (!b) return;
    state.size = b.getAttribute('data-size'); pick('sizes', 'size', state.size); $('err1').textContent = '';
  });
  $('speeds').addEventListener('click', function (e) {
    var b = e.target.closest('[data-speed]'); if (!b) return;
    state.speed = b.getAttribute('data-speed'); pick('speeds', 'speed', state.speed);
    $('whenWrap').hidden = state.speed !== 'scheduled';
  });
  // default scheduled time: tomorrow 9 AM
  var t = new Date(); t.setDate(t.getDate() + 1); t.setHours(9, 0, 0, 0);
  $('when').value = new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  function form() {
    return {
      pickup_address: $('pickup').value.trim(), dropoff_address: $('dropoff').value.trim(),
      load_size: state.size, pallets: +$('pallets').value || 0, weight_lbs: +$('weight').value || 0,
      speed: state.speed, scheduled_for: state.speed === 'scheduled' && $('when').value ? new Date($('when').value).toISOString() : null,
      helpers: +$('helpers').value, stairs_flights: +$('stairs').value,
    };
  }

  function showQuote(j) {
    state.quote = j;
    $('vehLabel').textContent = j.quote.vehicle_label + ' · ' + j.quote.miles + ' mi' + (j.long_haul ? ' · ' + (j.transit_days > 1 ? j.transit_days + '-day delivery' : 'delivered same day') : ' · ' + j.city_name);
    var note = '';
    if (j.long_haul) note = 'Long distance: one driver takes it straight there' + (j.transit_days > 1 ? ', about ' + j.transit_days + ' days on the road' : '') + '. You’ll get live tracking the whole way.';
    $('longNote').textContent = note; $('longNote').hidden = !note;
    $('total').textContent = money(j.quote.total_cents);
    $('lines').innerHTML = '';
    j.quote.lines.forEach(function (l) {
      var li = document.createElement('li');
      var a = document.createElement('span'); a.textContent = l.label;
      var b = document.createElement('span'); b.textContent = money(l.cents);
      li.appendChild(a); li.appendChild(b); $('lines').appendChild(li);
    });
    var sp = $('speedPrices'); sp.innerHTML = '';
    j.options.forEach(function (o) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'choice' + (o.speed === j.speed ? ' on' : '');
      var bb = document.createElement('b'); bb.textContent = o.label;
      var s = document.createElement('span'); s.textContent = money(o.total_cents);
      b.appendChild(bb); b.appendChild(s);
      b.addEventListener('click', function () {
        state.speed = o.speed; pick('speeds', 'speed', o.speed);
        $('whenWrap').hidden = o.speed !== 'scheduled';
        if (o.speed === 'scheduled') { $('step2').hidden = true; $('step1').hidden = false; $('when').focus(); return; }
        getQuote();
      });
      sp.appendChild(b);
    });
    $('step1').hidden = true; $('step2').hidden = false;
  }

  function getQuote() {
    var f = form();
    if (!f.pickup_address || !f.dropoff_address) { $('err1').textContent = 'Enter both addresses.'; return; }
    if (!f.load_size) { $('err1').textContent = 'Pick what we’re moving.'; return; }
    $('quoteBtn').disabled = true; $('quoteBtn').textContent = 'Getting your price…'; $('err1').textContent = '';
    post('/quote', f).then(function (j) {
      $('quoteBtn').disabled = false; $('quoteBtn').textContent = 'See my price';
      if (!j._ok) { $('err1').textContent = j.error || 'Something went wrong.'; $('step1').hidden = false; $('step2').hidden = true; return; }
      showQuote(j);
    });
  }
  $('book').addEventListener('submit', function (e) { e.preventDefault(); getQuote(); });
  $('editBtn').addEventListener('click', function () { $('step2').hidden = true; $('step1').hidden = false; });

  $('bookBtn').addEventListener('click', function () {
    var f = form();
    Object.assign(f, {
      item_description: $('items').value.trim(), customer_name: $('name').value.trim(), customer_phone: $('phone').value.trim(),
      customer_email: $('email').value.trim(), company: $('company').value.trim(),
      pickup_contact: $('pcontact').value.trim(), pickup_notes: $('pnotes').value.trim(),
      dropoff_contact: $('dcontact').value.trim(), dropoff_notes: $('dnotes').value.trim(),
      agree: $('agree').checked, website: $('website').value,
    });
    var err = !f.item_description ? 'Tell us what we’re picking up.' : !f.customer_name ? 'Enter your name.' : f.customer_phone.replace(/\D/g, '').length < 10 ? 'Enter a 10-digit mobile number.' : !f.agree ? 'Please agree to the Terms.' : '';
    if (err) { $('err2').textContent = err; return; }
    $('err2').textContent = ''; $('bookBtn').disabled = true; $('bookBtn').textContent = 'Booking…';
    post('/book', f).then(function (j) {
      $('bookBtn').disabled = false; $('bookBtn').textContent = 'Book delivery';
      if (!j._ok) { $('err2').textContent = j.error || 'Something went wrong.'; return; }
      if (j.checkout_url) { location.href = j.checkout_url; return; }
      $('step2').hidden = true; $('done').hidden = false;
      $('doneText').textContent = j.interstate_hold ? 'Request HZ-' + j.code + ' is in. Interstate delivery is opening soon; we’ll text you to confirm the date and price before anything is charged.' : 'Request HZ-' + j.code + ' is in. We’ll text you shortly to confirm and take payment.';
      $('trackLink').href = j.track_url;
    });
  });
})();
