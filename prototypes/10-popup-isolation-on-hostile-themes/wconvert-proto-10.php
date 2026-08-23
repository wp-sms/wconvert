<?php
/**
 * Plugin Name: WConvert prototype 10 — popup isolation on hostile themes
 *
 * THROWAWAY. Loads one isolation mode onto the front end of a real theme, and
 * serves the reference render (same markup + CSS, no theme at all) so the harness
 * has a ground truth to diff against.
 *
 *   ?wcv10=shadow|shadow-dir|shadow-bare|shadow-open|scoped|scoped-imp|iframe
 *   ?wcv10_ref=1        the intended render, no theme, no plugins
 *   ?wcv10_rtl=1        force dir="rtl" without switching site locale
 *   ?wcv10_clip=1       render a deliberately clipping ancestor to mount inline into
 *   ?wcv10_hostile=1..6 the synthetic hostile theme, escalating
 *   ?wcv10_z=<n>        override the container z-index
 *   ?wcv10_noa11y=1     skip the hand-written focus trap / Esc / inert layer
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const WCV10_DIR = __DIR__;
const WCV10_URL_REL = '/wp-content/plugins/wconvert/prototypes/10-popup-isolation-on-hostile-themes';

function wcv10_url( $path ) {
	return home_url( WCV10_URL_REL . $path );
}

/**
 * The reference render: the template's own markup and CSS in an otherwise empty
 * document. Everything the matrix reports as "leakage" is a delta from this.
 * Served before WordPress renders anything, so no theme and no plugin can touch it.
 */
add_action( 'template_redirect', function () {
	if ( ! isset( $_GET['wcv10_ref'] ) ) {
		return;
	}
	$css = file_get_contents( WCV10_DIR . '/dist/reference.css' );
	$css = str_replace( '@FONT@', wcv10_url( '/assets/fraunces.woff2' ), $css );
	$markup = file_get_contents( WCV10_DIR . '/dist/reference.html' );
	$dir = isset( $_GET['wcv10_rtl'] ) ? 'rtl' : 'ltr';
	header( 'Content-Type: text/html; charset=utf-8' );
	echo '<!doctype html><html dir="' . $dir . '" lang="en"><head><meta charset="utf-8">';
	echo '<meta name="viewport" content="width=device-width,initial-scale=1">';
	echo '<style>html,body{margin:0;padding:0;}' . $css . '</style></head><body>';
	echo $markup;
	echo '<script>document.documentElement.setAttribute("data-wcv10-ready","reference")</script>';
	echo '</body></html>';
	exit;
}, 0 );

/** Force RTL without changing the site locale, for the container-level question. */
add_filter( 'language_attributes', function ( $out ) {
	if ( isset( $_GET['wcv10_rtl'] ) && false === strpos( $out, 'dir=' ) ) {
		$out .= ' dir="rtl"';
	}
	return $out;
} );

add_action( 'wp_enqueue_scripts', function () {
	if ( is_admin() ) {
		return;
	}
	$mode = isset( $_GET['wcv10'] ) ? sanitize_key( $_GET['wcv10'] ) : '';
	if ( '' === $mode ) {
		return;
	}
	$file = WCV10_DIR . '/dist/proto.js';
	if ( ! file_exists( $file ) ) {
		return;
	}
	wp_enqueue_script( 'wcv10', wcv10_url( '/dist/proto.js' ), array(), (string) filemtime( $file ), true );
	wp_add_inline_script(
		'wcv10',
		'window.WCV10_FONT=' . wp_json_encode( wcv10_url( '/assets/fraunces.woff2' ) ) . ';'
			. ( isset( $_GET['wcv10_z'] ) ? 'window.WCV10_Z=' . (int) $_GET['wcv10_z'] . ';' : '' ),
		'before'
	);
} );

/**
 * A deliberately clipping ancestor. `inline` is the one display type that cannot
 * escape to <body>, so it is the only one that meets `overflow: hidden` for real.
 */
add_action( 'wp_footer', function () {
	if ( ! isset( $_GET['wcv10_clip'] ) ) {
		return;
	}
	echo '<div id="wcv10-clip" style="overflow:hidden;height:120px;width:300px;position:relative;border:2px solid #f0f;transform:translateZ(0);"></div>';
} );

/**
 * The synthetic hostile theme, in five escalating levels — ?wcv10_hostile=1..5.
 *
 * Real themes are hostile in ordinary ways and give the honest matrix. This gives
 * the CEILING: every documented sin at once, so a strategy that survives level 5
 * has nothing left to be surprised by.
 */
function wcv10_hostile_css( $level ) {
	$css = array();

	// 1. Ordinary theme: bare-tag overrides, no !important. Every theme does this.
	$css[] = '
		h2 { font-family: "Comic Sans MS", cursive; font-size: 41px; font-weight: 300;
		     text-transform: uppercase; letter-spacing: 3px; color: #b8002e; margin: 40px 0; line-height: 2.4; }
		p  { font-family: "Courier New", monospace; font-size: 19px; color: #0a7d3f; text-align: justify; line-height: 2.8; }
		button { background: #ff00d4; color: #002200; border: 6px dotted #00e5ff; border-radius: 0;
		         padding: 22px 40px; font-size: 22px; text-transform: uppercase; letter-spacing: 4px;
		         box-shadow: 8px 8px 0 #000; width: auto; height: auto; }
		input { border: 5px double #7a00ff; border-radius: 30px; padding: 26px; font-size: 21px;
		        background: #fff8b0; color: #7a00ff; height: auto; box-shadow: inset 0 0 20px #f0a; }
		form { border: 4px solid #f60; padding: 30px; background: #eef; }
		div { box-sizing: content-box; }';

	// 2. Aggressive theme: the same, now with !important. Common in one-click-demo themes.
	if ( $level >= 2 ) {
		$css[] = '
			h2 { font-family: "Comic Sans MS", cursive !important; font-size: 41px !important;
			     text-transform: uppercase !important; color: #b8002e !important; letter-spacing: 3px !important;
			     margin: 40px 0 !important; line-height: 2.4 !important; font-weight: 300 !important; }
			p  { font-family: "Courier New", monospace !important; font-size: 19px !important;
			     color: #0a7d3f !important; text-align: justify !important; line-height: 2.8 !important; }
			button, input[type=submit] { background: #ff00d4 !important; color: #002200 !important;
			     border: 6px dotted #00e5ff !important; border-radius: 0 !important; padding: 22px 40px !important;
			     font-size: 22px !important; text-transform: uppercase !important; letter-spacing: 4px !important;
			     box-shadow: 8px 8px 0 #000 !important; height: auto !important; width: auto !important; }
			input { border: 5px double #7a00ff !important; border-radius: 30px !important; padding: 26px !important;
			     font-size: 21px !important; background: #fff8b0 !important; color: #7a00ff !important;
			     height: auto !important; box-shadow: inset 0 0 20px #f0a !important; }';
	}

	// 3. The nuclear theme: a universal !important selector. Rare, but it exists,
	//    and it is the only thing that can beat a namespaced reset on specificity.
	if ( $level >= 3 ) {
		$css[] = '
			* { font-family: "Comic Sans MS", cursive !important; box-sizing: content-box !important;
			    letter-spacing: 3px !important; text-transform: uppercase !important;
			    border-radius: 0 !important; box-shadow: none !important; }';
	}

	// 4. Fixed-positioning killers: a transformed body makes `position: fixed`
	//    resolve against the body, not the viewport. Page builders do this for
	//    scroll effects and it is invisible until an overlay lands on the site.
	if ( $level >= 4 ) {
		$css[] = '
			html { overflow-x: hidden !important; }
			body { transform: translateZ(0) !important; filter: saturate(1) !important;
			       overflow-x: hidden !important; position: relative !important; }';
	}

	// 6. The last resort a container can face: the transform is on <html>, so
	//    there is no ancestor left to escape to. Only the top layer is outside it.
	if ( $level >= 6 ) {
		$css[] = '
			html { transform: translateZ(0) !important; }';
	}

	// 5. z-index war: a sticky header and a cookie banner both claiming the top.
	if ( $level >= 5 ) {
		$css[] = '
			#wcv10-sticky { position: fixed; top: 0; left: 0; right: 0; height: 90px; background: #123;
			                color: #fff; z-index: 2147483647; }
			#wcv10-banner { position: fixed; inset: 0; background: rgba(0,0,0,.6); z-index: 2147483647; }';
	}

	return implode( "\n", $css );
}

add_action( 'wp_head', function () {
	if ( ! isset( $_GET['wcv10_hostile'] ) ) {
		return;
	}
	$level = max( 1, min( 6, (int) $_GET['wcv10_hostile'] ) );
	echo "<style id='wcv10-hostile' data-level='{$level}'>" . wcv10_hostile_css( $level ) . '</style>';
}, 9999 );

add_action( 'wp_footer', function () {
	if ( ! isset( $_GET['wcv10_hostile'] ) || (int) $_GET['wcv10_hostile'] < 5 ) {
		return;
	}
	echo '<div id="wcv10-sticky">sticky header</div><div id="wcv10-banner">cookie banner</div>';
} );
