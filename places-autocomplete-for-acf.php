<?php
/**
 * Plugin Name:       Places Autocomplete for ACF
 * Plugin URI:        https://github.com/alexmeanpug/places-autocomplete-for-acf
 * Description:       Restores address search in the ACF Google Map field for Google Cloud projects that cannot enable the legacy Places API, by switching autocomplete to Places API (New).
 * Version:           1.0.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            CIRIC.dev
 * Author URI:        https://ciric.dev
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       places-autocomplete-for-acf
 *
 * Problem:
 * The ACF Google Map field uses google.maps.places.Autocomplete, which belongs to the
 * legacy Places API. Since March 1, 2025, Google no longer lets new Google Cloud projects
 * enable the legacy Places API. With such a key, typing into the field's search box
 * throws "LegacyApiNotActivatedMapError" and no suggestions appear.
 *
 * Solution:
 * 1. Remove the "places" library from the Google Maps script ACF loads, so ACF never
 *    creates the legacy Autocomplete.
 * 2. Add a suggestions dropdown powered by Places API (New)
 *    (AutocompleteSuggestion + Place.fetchFields).
 * 3. Convert the selected place to the shape ACF expects and save it with ACF's own
 *    field methods, so the stored value stays the same as before.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'CIRICDEV_PAACF_VERSION', '1.0.0' );
define( 'CIRICDEV_PAACF_FILE', __FILE__ );

/**
 * Bootstrap once all plugins are loaded, so we can check whether ACF is active.
 */
function ciricdev_paacf_bootstrap() {
	if ( ! class_exists( 'ACF' ) ) {
		add_action( 'admin_notices', 'ciricdev_paacf_missing_acf_notice' );
		return;
	}

	add_filter( 'acf/fields/google_map/api', 'ciricdev_paacf_filter_google_map_api', 99 );
	add_action( 'acf/input/admin_enqueue_scripts', 'ciricdev_paacf_enqueue_assets' );
}
add_action( 'plugins_loaded', 'ciricdev_paacf_bootstrap' );

/**
 * Admin notice shown when ACF (free or PRO) is not active.
 */
function ciricdev_paacf_missing_acf_notice() {
	if ( ! current_user_can( 'activate_plugins' ) ) {
		return;
	}

	printf(
		'<div class="notice notice-warning"><p>%s</p></div>',
		esc_html__( 'Places Autocomplete for ACF requires Advanced Custom Fields (free or PRO) to be installed and active.', 'places-autocomplete-for-acf' )
	);
}

/**
 * Stop ACF from loading the legacy "places" library.
 *
 * @param array $api Google Maps API parameters used by ACF.
 * @return array
 */
function ciricdev_paacf_filter_google_map_api( $api ) {
	if ( is_array( $api ) ) {
		unset( $api['libraries'] );
	}
	return $api;
}

/**
 * Enqueue the autocomplete script and styles wherever ACF loads its field UI
 * (wp-admin edit screens and front-end acf_form()).
 */
function ciricdev_paacf_enqueue_assets() {
	$base_url = plugin_dir_url( CIRICDEV_PAACF_FILE );

	wp_enqueue_style(
		'ciricdev-paacf',
		$base_url . 'assets/css/admin.css',
		array(),
		CIRICDEV_PAACF_VERSION
	);

	wp_enqueue_script(
		'ciricdev-paacf',
		$base_url . 'assets/js/admin.js',
		array( 'jquery', 'acf-input' ),
		CIRICDEV_PAACF_VERSION,
		true
	);

	/**
	 * Filters the settings passed to the autocomplete script.
	 *
	 * @param array $settings {
	 *     @type int      $minChars            Minimum characters before suggestions are requested. Default 3.
	 *     @type int      $debounce            Delay in milliseconds after typing stops. Default 250.
	 *     @type string[] $includedRegionCodes Up to 15 CLDR two-letter region codes to limit results, e.g. array( 'us' ). Default empty.
	 *     @type string   $language            Language for suggestions, e.g. 'en'. Default: site locale language.
	 * }
	 */
	$settings = apply_filters(
		'ciricdev_paacf_settings',
		array(
			'minChars'            => 3,
			'debounce'            => 250,
			'includedRegionCodes' => array(),
			'language'            => substr( determine_locale(), 0, 2 ),
		)
	);

	$settings['i18n'] = array(
		'listLabel'     => __( 'Address suggestions', 'places-autocomplete-for-acf' ),
		'linkText'      => __( 'Open Google Cloud Console', 'places-autocomplete-for-acf' ),
		'errNotEnabled' => __( 'Address search is unavailable: Places API (New) is not enabled in the Google Cloud project for this API key. Enable it, wait a few minutes, then try again.', 'places-autocomplete-for-acf' ),
		'errBlocked'    => __( 'Address search is unavailable: this API key is restricted and does not allow Places API (New). Add Places API (New) to the key\'s API restrictions.', 'places-autocomplete-for-acf' ),
		'errReferrer'   => __( 'Address search is unavailable: this website is not allowed by the API key\'s website restrictions. Add this domain to the key.', 'places-autocomplete-for-acf' ),
		'errBilling'    => __( 'Address search is unavailable: billing is not enabled for the Google Cloud project of this API key.', 'places-autocomplete-for-acf' ),
		'errNoMaps'     => __( 'Address search is unavailable: the Google Maps JavaScript API did not load correctly.', 'places-autocomplete-for-acf' ),
		'errGeneric'    => __( 'Address search is unavailable right now. See the browser console for details.', 'places-autocomplete-for-acf' ),
	);

	wp_localize_script( 'ciricdev-paacf', 'ciricdevPaacf', $settings );
}
