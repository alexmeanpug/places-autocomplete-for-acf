/**
 * Places Autocomplete for ACF
 *
 * Replaces the legacy Places Autocomplete in the ACF Google Map field
 * with a suggestions dropdown powered by Places API (New).
 */
(function ($) {
	'use strict';

	if (typeof acf === 'undefined') {
		return;
	}

	var settings = window.ciricdevPaacf || {};
	var MIN_CHARS = parseInt(settings.minChars, 10) || 3;
	var DEBOUNCE = parseInt(settings.debounce, 10) || 250;
	var LOG_PREFIX = '[Places Autocomplete for ACF]';
	var i18n = settings.i18n || {};
	var uid = 0;
	var placesPromise = null;

	var CONSOLE_URL = 'https://console.cloud.google.com/apis/library/places.googleapis.com';
	var CREDENTIALS_URL = 'https://console.cloud.google.com/apis/credentials';

	/**
	 * Turn a Google Maps error into a short, actionable message for the user.
	 */
	function describeError(err) {
		var msg = String((err && (err.message || err)) || '');

		// Front-end forms and non-admin users only get a generic message, without links.
		if (!settings.showDetails) {
			return { message: i18n.errGeneric, url: '' };
		}

		if (/has not been used in project|is disabled|SERVICE_DISABLED|not activated/i.test(msg)) {
			return { message: i18n.errNotEnabled, url: CONSOLE_URL };
		}
		if (/are blocked|API_KEY_SERVICE_BLOCKED/i.test(msg)) {
			return { message: i18n.errBlocked, url: CREDENTIALS_URL };
		}
		if (/referer|referrer|RefererNotAllowed/i.test(msg)) {
			return { message: i18n.errReferrer, url: CREDENTIALS_URL };
		}
		if (/billing/i.test(msg)) {
			return { message: i18n.errBilling, url: 'https://console.cloud.google.com/billing' };
		}
		if (/importLibrary/i.test(msg)) {
			return { message: i18n.errNoMaps, url: '' };
		}
		return { message: i18n.errGeneric, url: '' };
	}

	/**
	 * Load the Places library (New) once and share it between all map fields.
	 */
	function loadPlaces() {
		if (!placesPromise) {
			if (!window.google || !google.maps || typeof google.maps.importLibrary !== 'function') {
				placesPromise = Promise.reject(new Error('google.maps.importLibrary is not available.'));
			} else {
				placesPromise = google.maps.importLibrary('places').then(function (lib) {
					// Keep ACF from creating a legacy Autocomplete on fields initialized later (e.g. repeater rows).
					try {
						if (google.maps.places) {
							google.maps.places.Autocomplete = undefined;
						}
					} catch (e) {}
					return lib;
				});
			}
		}
		return placesPromise;
	}

	acf.addAction('google_map_init', function (map, marker, field) {
		var $el = (field && field.$el) ? field.$el : $(map.getDiv()).closest('.acf-field');
		var input = $el.find('input.search')[0];

		if (!input || input.getAttribute('data-ciricdev-paacf')) {
			return;
		}

		var listId = 'ciricdev-paacf-list-' + (++uid);

		input.setAttribute('data-ciricdev-paacf', '1');
		input.setAttribute('autocomplete', 'off');
		input.setAttribute('role', 'combobox');
		input.setAttribute('aria-autocomplete', 'list');
		input.setAttribute('aria-expanded', 'false');
		input.setAttribute('aria-controls', listId);

		var box = document.createElement('div');
		box.id = listId;
		box.className = 'ciricdev-paacf-list';
		box.setAttribute('role', 'listbox');
		if (settings.i18n && settings.i18n.listLabel) {
			box.setAttribute('aria-label', settings.i18n.listLabel);
		}
		input.parentNode.appendChild(box);

		// Error notice shown under the input when Google rejects a request.
		var notice = document.createElement('div');
		notice.className = 'ciricdev-paacf-notice';
		notice.setAttribute('role', 'alert');
		// Keep focus in the input when the notice is clicked (links inside still work).
		notice.addEventListener('mousedown', function (e) {
			if (e.target.tagName !== 'A') {
				e.preventDefault();
			}
		});
		input.parentNode.appendChild(notice);

		var preds = [];
		var active = -1;
		var token = null;
		var timer = null;
		var reqId = 0;

		function hideNotice() {
			notice.innerHTML = '';
			notice.style.display = 'none';
		}

		function showError(err) {
			var e = describeError(err);

			close();
			notice.innerHTML = '';

			var text = document.createElement('span');
			text.textContent = e.message + ' ';
			notice.appendChild(text);

			if (e.url && i18n.linkText) {
				var link = document.createElement('a');
				link.href = e.url;
				link.target = '_blank';
				link.rel = 'noopener noreferrer';
				link.textContent = i18n.linkText;
				notice.appendChild(link);
			}

			notice.style.display = 'block';
		}

		function close() {
			box.innerHTML = '';
			box.style.display = 'none';
			preds = [];
			active = -1;
			input.setAttribute('aria-expanded', 'false');
			input.removeAttribute('aria-activedescendant');
		}

		function highlight(i) {
			var nodes = box.children;
			for (var n = 0; n < nodes.length; n++) {
				var on = (n === i);
				nodes[n].classList.toggle('is-active', on);
				nodes[n].setAttribute('aria-selected', on ? 'true' : 'false');
			}
			active = i;
			if (i >= 0 && nodes[i]) {
				input.setAttribute('aria-activedescendant', nodes[i].id);
				nodes[i].scrollIntoView({ block: 'nearest' });
			} else {
				input.removeAttribute('aria-activedescendant');
			}
		}

		function render(list) {
			box.innerHTML = '';
			preds = list;
			active = -1;

			if (!list.length) {
				close();
				return;
			}

			list.forEach(function (p, i) {
				var item = document.createElement('div');
				item.id = listId + '-' + i;
				item.className = 'ciricdev-paacf-item';
				item.setAttribute('role', 'option');
				item.setAttribute('aria-selected', 'false');

				var main = document.createElement('strong');
				main.textContent = p.mainText ? p.mainText.toString() : p.text.toString();
				item.appendChild(main);

				if (p.secondaryText) {
					var sec = document.createElement('span');
					sec.textContent = ' ' + p.secondaryText.toString();
					item.appendChild(sec);
				}

				// mousedown + preventDefault keeps focus in the input, so ACF doesn't run its own search on blur.
				item.addEventListener('mousedown', function (e) { e.preventDefault(); });
				item.addEventListener('click', function () { choose(p); });
				item.addEventListener('mouseenter', function () { highlight(i); });
				box.appendChild(item);
			});

			box.style.display = 'block';
			input.setAttribute('aria-expanded', 'true');
		}

		async function fetchSuggestions(q) {
			var id = ++reqId;

			try {
				var lib = await loadPlaces();

				if (!token) {
					token = new lib.AutocompleteSessionToken();
				}

				var request = { input: q, sessionToken: token };

				var center = map.getCenter();
				if (center) {
					request.origin = center;
				}
				if (settings.language) {
					request.language = settings.language;
				}
				if (Array.isArray(settings.includedRegionCodes) && settings.includedRegionCodes.length) {
					request.includedRegionCodes = settings.includedRegionCodes;
				}

				// Allow developers to adjust the request, e.g. acf.addFilter('ciricdev_paacf_request', fn).
				request = acf.applyFilters('ciricdev_paacf_request', request, field, map);

				var res = await lib.AutocompleteSuggestion.fetchAutocompleteSuggestions(request);

				if (id !== reqId) {
					return; // A newer request has already been sent.
				}

				hideNotice();
				render(res.suggestions
					.filter(function (s) { return s.placePrediction; })
					.map(function (s) { return s.placePrediction; }));
			} catch (e) {
				if (window.console) {
					console.error(LOG_PREFIX + ' Autocomplete error:', e);
				}
				if (id === reqId) {
					showError(e);
				}
			}
		}

		async function choose(pred) {
			close();

			try {
				var place = pred.toPlace();
				await place.fetchFields({
					fields: ['id', 'displayName', 'formattedAddress', 'location', 'addressComponents']
				});
				token = null; // End of session (Autocomplete is billed per session).
				apply(place);
			} catch (e) {
				if (window.console) {
					console.error(LOG_PREFIX + ' Place details error:', e);
				}
				showError(e);
			}
		}

		function apply(place) {
			var loc = place.location;
			var address = place.formattedAddress || input.value;

			// Convert the new Place object into the legacy shape ACF's parseResult() expects.
			var legacy = {
				geometry: { location: loc },
				formatted_address: address,
				name: place.displayName,
				place_id: place.id,
				address_components: (place.addressComponents || []).map(function (c) {
					return { long_name: c.longText, short_name: c.shortText, types: c.types };
				})
			};

			if (field && typeof field.parseResult === 'function' && typeof field.setValue === 'function') {
				var val = field.parseResult(legacy);
				val.address = address;
				field.setValue(val);
			} else {
				// Fallback for older ACF versions.
				var fallback = {
					address: address,
					lat: loc.lat(),
					lng: loc.lng(),
					zoom: map.getZoom(),
					place_id: place.id,
					name: place.displayName
				};
				$el.find('input[type="hidden"]').first().val(JSON.stringify(fallback)).trigger('change');
				input.value = address;
				marker.setPosition(loc);
				marker.setVisible(true);
				$el.find('.acf-google-map').addClass('-value');
			}

			map.setCenter(loc);
			acf.doAction('ciricdev_paacf_place_selected', place, field, map);
		}

		input.addEventListener('input', function () {
			clearTimeout(timer);
			var q = input.value.trim();

			if (q.length < MIN_CHARS) {
				reqId++; // Ignore any response still in flight.
				close();
				hideNotice();
				return;
			}

			timer = setTimeout(function () { fetchSuggestions(q); }, DEBOUNCE);
		});

		input.addEventListener('keydown', function (e) {
			if (e.key === 'Escape') {
				hideNotice();
			}

			if (!preds.length) {
				return; // Dropdown closed: let ACF handle keys as usual.
			}

			if (e.key === 'ArrowDown') {
				e.preventDefault();
				highlight(Math.min(active + 1, preds.length - 1));
			} else if (e.key === 'ArrowUp') {
				e.preventDefault();
				highlight(Math.max(active - 1, 0));
			} else if (e.key === 'Enter') {
				e.preventDefault();
				e.stopPropagation(); // Don't let ACF's Enter handler run.
				choose(preds[active >= 0 ? active : 0]);
			} else if (e.key === 'Escape') {
				e.preventDefault();
				close();
			}
		});

		input.addEventListener('blur', function () {
			setTimeout(close, 150);
		});
	});
})(jQuery);
