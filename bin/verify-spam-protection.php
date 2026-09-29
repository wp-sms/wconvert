<?php
/** Run only on a disposable WordPress/MySQL install with WCONVERT_VERIFY_SPAM=true.
 * The surrounding test harness must intercept outbound HTTP; no real provider keys are needed.
 */
declare(strict_types=1);
if (!defined('WCONVERT_VERIFY_SPAM') || WCONVERT_VERIFY_SPAM !== true) { throw new RuntimeException('Disposable WordPress required.'); }

function spamCheck(bool $ok, string $message): void { if (!$ok) throw new RuntimeException($message); echo "PASS {$message}\n"; }
/** @param array<string, mixed> $body */
function spamRequest(string $path, string $method = 'GET', array $body = []): WP_REST_Response {
    $request = new WP_REST_Request($method, '/wconvert/v1/' . $path);
    $request->set_header('Content-Type','application/json');
    if ($method === 'POST') $request->set_body((string) wp_json_encode($body));
    return rest_do_request($request);
}
$c = WConvert\Bootstrap::container();
$c->resolve(WConvert\Database\Installer::class)->install();
wp_set_current_user(0);
spamCheck(in_array(spamRequest('protection')->get_status(), [401,403], true), 'settings require an administrator');
wp_set_current_user(1);
$settings=$c->resolve(WConvert\Protection\Settings::class);
$settings->save(['provider'=>'none','rules'=>[]]);
$template=json_decode((string) file_get_contents(WCONVERT_DIR.'resources/templates/library/journey-email-only.json'),true);
$config=['template'=>$template,'display_type'=>'popup','capture_mode'=>'local','display_rules'=>WConvert\Rules\DisplayPlan::immediate()];
$optins=$c->resolve(WConvert\Optin\OptinRepository::class);
$optin=$optins->create('Spam protection QA','grow_email_list',$config);
$optins->publish($optin->id);
$base=['optin_id'=>$optin->id,'contract'=>WConvert\Template\CaptureContract::fingerprint($config,$optin->goal,get_privacy_policy_url())];
$submission=$base+['submission'=>$template['tree']['submissions'][0]['id'],'fields'=>['email'=>'qa@example.test'],'consent'=>true];
$old=spamRequest('capture','POST',$base+['phase'=>'start'])->get_data()['grant'];
spamCheck(spamRequest('capture','POST',$base+['phase'=>'start','website'=>'bot'])->get_status()===422,'honeypot rejected before grant issuance');
foreach(['turnstile','recaptcha','hcaptcha'] as $provider) {
    $saved=spamRequest('protection','POST',['provider'=>$provider,'site_key'=>'public-key','secret'=>'secret-key']);
    spamCheck($saved->get_status()===200 && !str_contains((string)wp_json_encode($saved->get_data()),'secret-key'),$provider.' keys are saved but never returned');
    spamCheck(isset(spamRequest('capture','POST',$base+['phase'=>'start'])->get_data()['challenge']),$provider.' requires a challenge');
    spamCheck(spamRequest('capture','POST',$submission+['grant'=>$old])->get_status()===409,$provider.' rejects grants minted before its configuration');
    spamCheck(spamRequest('capture','POST',$base+['phase'=>'start','verification_token'=>'bad'])->get_status()===422,$provider.' rejects failed verification');
    $proof=spamRequest('capture','POST',$base+['phase'=>'start','verification_token'=>'smoke-pass']);
    spamCheck(isset($proof->get_data()['grant']),$provider.' verified response creates a signed grant');
    $body=$submission+['grant'=>$proof->get_data()['grant']];
    $first=spamRequest('capture','POST',$body);$second=spamRequest('capture','POST',$body);
    spamCheck($first->get_status()===201 && $second->get_status()===200 && $first->get_data()['id']===$second->get_data()['id'],$provider.' retry returns the same lead');
}
$settings->save(['provider'=>'none','rules'=>['blocked_domains'=>'blocked.test','allowed_emails'=>'allowed@blocked.test']]);
$grant=spamRequest('capture','POST',$base+['phase'=>'start'])->get_data()['grant'];
$blocked=array_replace($submission,['grant'=>$grant,'fields'=>['email'=>'bad@blocked.test']]);
spamCheck(spamRequest('capture','POST',$blocked)->get_status()===422,'Pro email rule rejects before capture');
$allowed=array_replace($blocked,['fields'=>['email'=>'allowed@blocked.test']]);
spamCheck(spamRequest('capture','POST',$allowed)->get_status()===201,'Pro exception allows the intended address');
$guard=new WConvert\Protection\ResourceSendGuard($c->resolve(WConvert\Database\Connection::class),$c->resolve(WConvert\Protection\Diagnostics::class));
$sends=0;$send=static function()use(&$sends){$sends++;return WConvert\Destination\PushResult::success();};
$resource='https://example.test/resource-'.bin2hex(random_bytes(8));
$guard->send('same@example.test',$resource,$send);$guard->send('same@example.test',$resource,$send);
spamCheck($sends===1,'same recipient/resource sends once within the window');
$guard->send('different@example.test',$resource,$send);
spamCheck($sends===2,'another recipient remains eligible');
$guard->prune();
$settings->save(['provider'=>'turnstile','site_key'=>'public-key','secret'=>'secret-key','rules'=>[]]);
update_option('spam_qa_campaign',$optin->id,false);
echo "Campaign: {$optin->id}\n";
