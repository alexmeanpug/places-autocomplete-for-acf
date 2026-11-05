=== Places Autocomplete for ACF ===
Contributors: ciricdev
Tags: acf, google maps, places api, autocomplete, address
Requires at least: 6.0
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Fixes "LegacyApiNotActivatedMapError" in the ACF Google Map field by switching its address search to Google Places API (New).

== Description ==

The Google Map field in Advanced Custom Fields (ACF) uses Google's legacy Places API for its address search. Since March 1, 2025, Google no longer lets new Google Cloud projects enable the legacy Places API.

If your API key comes from a new project, the map loads, but as soon as you type an address nothing happens and the browser console shows:

`You're calling a legacy API, which is not enabled for your project ... LegacyApiNotActivatedMapError`

This plugin fixes that without changing your fields or your saved data:

* Stops ACF from loading the legacy Places library.
* Adds an address suggestions dropdown to the Google Map field, powered by Places API (New).
* Saves the selected place through ACF's own field methods, so the stored value (address, lat, lng, place_id, street, city, state, post code, country, etc.) has the same format as before.
* Works in wp-admin, in repeater and flexible content rows, and in front-end forms built with `acf_form()`.
* Supports keyboard navigation (arrow keys, Enter, Escape) and screen readers (ARIA combobox/listbox).
* Shows a clear message right under the field when Google rejects a request (API not enabled, key restricted, domain not allowed, billing off), with a link to Google Cloud Console.
* Uses Autocomplete session tokens, so Google bills each address search as a single session.

No settings page. Activate it and the field works.

**Requirements**

* Advanced Custom Fields or ACF PRO.
* A Google Maps API key that ACF already uses, with these APIs enabled in Google Cloud Console:
  * Maps JavaScript API
  * Geocoding API
  * Places API (New)

This plugin is not affiliated with or endorsed by WP Engine (ACF) or Google.

== External services ==

This plugin connects to the Google Maps Platform, Places API (New), to show address suggestions and retrieve the selected place's location in the ACF Google Map field.

* **When:** only on screens where an ACF Google Map field is shown, and only when a user types at least 3 characters into the field's search box or selects a suggestion.
* **What is sent:** the text typed into the search box, the current map center (to rank nearby results first), the site language, an anonymous session token, and the Google Maps API key configured for ACF. Google also receives the usual browser request data, such as the IP address and the page URL (referrer).
* **Provider:** Google LLC.
* Google Maps Platform Terms of Service: https://cloud.google.com/maps-platform/terms
* Google Privacy Policy: https://policies.google.com/privacy

ACF itself already loads the Google Maps JavaScript API on these screens. This plugin does not add any other external requests.

== Installation ==

1. Upload the `places-autocomplete-for-acf` folder to `/wp-content/plugins/`, or install it from Plugins > Add New.
2. Activate the plugin.
3. In Google Cloud Console, make sure Maps JavaScript API, Geocoding API and Places API (New) are enabled for the API key ACF uses. If the key has "API restrictions", add these three APIs to the list.
4. Open a post with an ACF Google Map field and start typing an address.

== Frequently Asked Questions ==

= Do I need this plugin? =

You need it if typing in the ACF Google Map search box shows no suggestions and the browser console shows `LegacyApiNotActivatedMapError`. This usually happens with API keys from Google Cloud projects created after March 1, 2025.

If your project still has the legacy Places API enabled, the field already works, but this plugin moves it to the newer API.

= Will my existing map values change? =

No. Existing values are not touched. New selections are saved in the same format ACF uses.

= I see a red message under the search box. What does it mean? =

Google rejected the request, and the message says why. The most common causes are:

* Places API (New) is not enabled in the Google Cloud project that owns the key.
* The key has API restrictions that do not include Places API (New).
* The key's website restrictions do not include your admin domain.

After changing settings in Google Cloud Console, wait a few minutes and reload the page.

= I still see an error in the console. =

Check that Places API (New) is enabled for the project that owns the key, and that the key's website restrictions include your admin domain. Errors from this plugin start with `[Places Autocomplete for ACF]`.

= Can I limit suggestions to one country? =

Yes, with the `ciricdev_paacf_settings` filter:

`add_filter( 'ciricdev_paacf_settings', function ( $settings ) {
	$settings['includedRegionCodes'] = array( 'us' );
	return $settings;
} );`

Available keys: `minChars` (default 3), `debounce` in milliseconds (default 250), `includedRegionCodes` (up to 15 two-letter codes), `language` (default: site language).

= Can I change the request in JavaScript? =

Yes. Use the `ciricdev_paacf_request` ACF JS filter to adjust the Places API (New) autocomplete request, and the `ciricdev_paacf_place_selected` action to react when a place is chosen:

`acf.addFilter( 'ciricdev_paacf_request', function ( request, field, map ) {
	request.includedPrimaryTypes = [ 'street_address' ];
	return request;
} );`

= Does it work with ACF PRO? =

Yes. It works with both the free and PRO versions of ACF.

== Contributing ==

Development happens on GitHub: https://github.com/alexmeanpug/places-autocomplete-for-acf

Bug reports and pull requests are welcome.

== Changelog ==

= 1.0.0 =
* Initial release.

== Upgrade Notice ==

= 1.0.0 =
Initial release.
