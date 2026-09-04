<?php

namespace WConvert\Pro\Module\AbTesting;

use WConvert\Optin\OptinRepository;
use WConvert\Rest\RestController;
use WConvert\Rest\Routes;
use WConvert\Support\Ulid;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

defined('ABSPATH') || exit;

/**
 * Starting an A/B test, and ending one.
 *
 * =============================================================================
 * THESE TWO ROUTES ARE THE ENTITLEMENT. THERE IS NO GUARD INSIDE EITHER.
 * =============================================================================
 * A module is a directory, and a build that does not ship `ab-testing` does not
 * have this file — so `class_exists()` is false, {@see ProServiceProvider} adds
 * nothing to `rest_api_init`, and the routes are absent rather than present and
 * refusing (ADR 0015). Nothing here asks whether Pro is loaded, what tier this
 * is, or what a licence says: this code running IS the answer to all three.
 *
 * That is also why it is a controller of Pro's own rather than two more methods
 * on free's {@see \WConvert\Rest\OptinController}. Methods on free's controller
 * would need a branch to refuse on a free install, which is the shape ADR 0015
 * exists to delete.
 *
 * =============================================================================
 * AND THE WRITES ARE FREE'S, WHICH IS NOT AN INCONSISTENCY.
 * =============================================================================
 * {@see OptinRepository} is *"the one place the published set is rebuilt"*, and
 * that property is what ADR 0003 rests on — "there is no promote-without-
 * rebuild path to forget to pair with one". A second writer of
 * `wconvert_optins` living over here would be exactly that path, and it would
 * also be a second place able to reach for a `DELETE` that ADR 0020 forbids
 * ({@see \WConvert\Database\Connection} deliberately has none).
 *
 * So the repository owns the two writes and this owns the two ROUTES. The same
 * division free's presenter already has with Pro's, one bundle over: free
 * exports `captureInto` precisely so Pro composes rather than copies.
 *
 * @since 0.1.0
 */
final class AbTestController implements RestController
{
    /** A ULID, spelled as a route constraint so a malformed id 404s at the router. */
    private const ID_PATTERN = '(?P<id>' . Ulid::PATTERN . ')';

    public function __construct(private readonly OptinRepository $optins)
    {
    }

    public function registerRoutes(): void
    {
        // Under `/optins/<ulid>/` because that is what a [[Variant]] is about:
        // it is a second Optin OF this one, and the sub-resource is the
        // sentence. Free's `publish` and `unpublish` are shaped the same way,
        // and for the same reason a POST rather than a field on the PATCH —
        // it writes a row that did not exist, which a `variant: true` on an
        // update would hide.
        register_rest_route(Routes::NAMESPACE, '/optins/' . self::ID_PATTERN . '/variants', [
            [
                'methods' => 'POST',
                'callback' => [$this, 'store'],
                'permission_callback' => [Routes::class, 'canManage'],
                // **No `name` argument, and its absence is the feature.** A
                // Variant is never asked for a name; it takes its parent's
                // with a letter (ADR 0045). Accepting one here would be a
                // second door onto naming that the repository's rule then has
                // to be kept in step with.
            ],
        ]);

        register_rest_route(Routes::NAMESPACE, '/optins/' . self::ID_PATTERN . '/winner', [
            [
                'methods' => 'POST',
                'callback' => [$this, 'declare'],
                'permission_callback' => [Routes::class, 'canManage'],
                'args' => [
                    'winner' => ['required' => true, 'type' => 'string'],
                ],
            ],
        ]);
    }

    /**
     * Start a test: a second Optin that is a copy of this one.
     *
     * It comes back whole rather than as a 204, because creating a variant
     * lands the merchant looking at it — the same reason free's `store` returns
     * the Optin it made.
     *
     * @return WP_REST_Response|WP_Error
     */
    public function store(WP_REST_Request $request)
    {
        $variant = $this->optins->createVariant((string) $request->get_param('id'));

        // One refusal for three cases — no such Optin, a deleted one, and an
        // Optin that is already an arm of somebody else's test — because all
        // three are the same answer to the merchant: there is nothing here to
        // make a variant of. The repository is where each is decided.
        if ($variant === null) {
            return new WP_Error(
                'wconvert_no_such_optin',
                __('There is no Optin here to test against.', 'wconvert-pro'),
                ['status' => 404]
            );
        }

        return new WP_REST_Response($variant->toArray(), 201);
    }

    /**
     * End it: this arm becomes the campaign and every other arm is tidied away.
     *
     * **Nothing is deleted**, and the repository is where that is enforced
     * rather than promised — ADR 0020 forbids hard-deleting an Optin because a
     * removed row makes every count naming it uninterpretable, and the losing
     * arm is a month of the merchant's own history.
     *
     * @return WP_REST_Response|WP_Error
     */
    public function declare(WP_REST_Request $request)
    {
        $declared = $this->optins->declareWinner(
            (string) $request->get_param('id'),
            (string) $request->get_param('winner')
        );

        if (!$declared) {
            return new WP_Error(
                'wconvert_not_an_arm_of_this_test',
                __('That is not one of this test’s arms.', 'wconvert-pro'),
                ['status' => 400]
            );
        }

        return new WP_REST_Response(null, 204);
    }
}
