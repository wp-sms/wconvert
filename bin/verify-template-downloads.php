<?php
/** Disposable WordPress rehearsal. Intercepts every HTTP request; never use against real credentials.
 * Boot through Playground with both plugins and WCONVERT_LICENSE_KEY=local-fixture-key.
 */
declare(strict_types=1);
use WConvert\Template\Catalog\{TemplateCatalog, CatalogTransport, PackValidator, InstalledPacks, VerifiedAssets};

if (!defined('WCONVERT_VERSION') || !defined('WCONVERT_PRO_VERSION') || !defined('WCONVERT_LICENSE_KEY') || WCONVERT_LICENSE_KEY !== 'local-fixture-key') throw new RuntimeException('Disposable fixture boot required.');
$origin = 'https://templates.example';
$assert = static function ($ok, string $message): void { if (!$ok) throw new RuntimeException($message); };
$http = WConvert\Bootstrap::container()->resolve(CatalogTransport::class);
$assert($http instanceof WConvert\Pro\License\TemplateDownloads, 'Pro must register the premium transport in the real container.');
$image = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA1sAAAAASUVORK5CYII=');
$source = file_get_contents(WCONVERT_DIR . '/resources/templates/library/reading-slip.json');
if ($source === false) throw new RuntimeException('Missing fixture');
$entry = json_decode($source, true);
$entry['tier'] = 'pro';
$entry['tree']['steps'][0]['content']['children'][] = ['type'=>'image','id'=>'n99','src'=>'','alt'=>'Test image'];
$pack = ['schema'=>2,'id'=>'private-rehearsal','name'=>'Private rehearsal','description'=>'Disposable fixture.','version'=>'1.0.0',
    'requires'=>['plugin'=>'0.1.0','tree'=>2,'capabilities'=>['template-tree:2','capture-journey:1','pack-images:1']],
    'templates'=>[$entry], 'assets'=>[['id'=>'cover','sha256'=>hash('sha256',$image),'mime'=>'image/png','bytes'=>strlen($image),'width'=>1,'height'=>1,'access'=>'premium']],
    'image_bindings'=>[['template_id'=>$entry['id'],'node_id'=>'n99','asset_id'=>'cover']]];
$json = json_encode($pack, JSON_THROW_ON_ERROR); $digest = hash('sha256',$json);
$catalogJson = json_encode(['schema'=>1,'packs'=>[[...array_intersect_key($pack,array_flip(['id','name','description','version'])),'access'=>'premium','sha256'=>$digest,'url'=>"$origin/downloads/$digest.json"]]]);
$state = new class {
    /** @var list<array{string, array<string, mixed>}> */
    public array $calls=[];
    public bool $offline=false;
    public string $mode='ok';
};
$intercept = static function ($pre, array $args, string $url) use ($state,$origin,$json,$catalogJson,$image,$assert) {
    $state->calls[] = [$url,$args];
    if ($state->offline) return new WP_Error('offline','Simulated unavailable server');
    $assert(str_starts_with($url,$origin.'/'),'No external requests permitted');
    if (str_ends_with($url,'/grants')) {
        $assert(($args['headers']['X-License-Key']??'') === 'local-fixture-key','Credential missing on grant request');
        if ($state->mode === 'expired') return ['response'=>['code'=>403],'body'=>'{"error_code":"license_expired"}','headers'=>[]];
        return ['response'=>['code'=>200],'body'=>'{"grant":"a.b.c","expires_in":300}','headers'=>[]];
    }
    $assert(!isset($args['headers']['X-License-Key']),'Credential leaked to file endpoint');
    if (str_contains($url,'/downloads/') || str_contains($url,'/assets/premium/')) $assert(($args['headers']['Authorization']??'')==='Bearer a.b.c','Private file missing pass');
    $body = str_ends_with($url,'/manifest.json') ? $catalogJson : (str_contains($url,'/assets/') ? ($state->mode==='damaged' ? 'bad' : $image) : $json);
    return ['response'=>['code'=>200],'body'=>$body,'headers'=>[]];
};
add_filter('pre_http_request',$intercept,1,3);
$options = new class($origin) implements WConvert\Storage\OptionStore {
    /** @var array<string, mixed> */
    private array $data;
    public function __construct(string $origin) { $this->data=[TemplateCatalog::SOURCE_OPTION=>$origin.'/manifest.json']; }
    public function get(string $key,$default=null) { return $this->data[$key]??$default; }
    public function set(string $key,$value):void { $this->data[$key]=$value; }
};
$directory = sys_get_temp_dir().'/wconvert-downloads-'.bin2hex(random_bytes(6));
$validator = PackValidator::shipping();
$installed = new InstalledPacks($directory.'/packs',$validator,new VerifiedAssets($directory.'/images',home_url('/fixture-images')));
$catalog = new TemplateCatalog($options,$http,$validator,$installed);
try {
    $catalog->refresh();
    $state->mode='damaged';
    try { $catalog->preview($pack['id']); throw new RuntimeException('Damaged image accepted'); }
    catch (RuntimeException $e) { $assert(str_contains($e->getMessage(),'does not match'),'Expected image verification refusal: '.$e->getMessage()); }
    $assert($installed->entries()===[],'Failed image set installed content');
    $state->mode='ok'; $preview=$catalog->preview($pack['id']);
    $assert($installed->entries()===[],'Preview unexpectedly installed pack');
    $catalog->install($pack['id'],$preview['digest']);
    $assert(count($installed->entries())===1,'Pack did not install');
    $assert(str_contains(json_encode($installed->entries(), JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES),home_url('/fixture-images/premium/')),'Image URL is not local');
    $state->mode='expired';
    try { $catalog->preview($pack['id']); throw new RuntimeException('Expired licence accepted'); }
    catch (RuntimeException $e) { $assert(str_contains($e->getMessage(),'person managing your licence'),'Wrong managed-licence message'); }
    $before=count($state->calls); $state->offline=true;
    $assert($catalog->preview($pack['id'],true)===$preview,'Installed preview changed offline');
    $assert(count($state->calls)===$before,'Offline preview made a network call');
    $assert(!str_contains(json_encode($catalog->status(), JSON_THROW_ON_ERROR),'local-fixture-key') && !str_contains(json_encode($preview, JSON_THROW_ON_ERROR),'a.b.c'),'Secret leaked in admin response');
    echo "WordPress " . get_bloginfo('version') . "; PHP " . PHP_VERSION . "\n";
    echo "PASS: WordPress boot, Pro wiring, server-only credentials, premium pack/image install, damaged-image refusal, expiry refusal, offline installed preview.\n";
} finally {
    remove_filter('pre_http_request',$intercept,1);
    if (is_dir($directory)) {
        $files=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($directory,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($files as $file) $file->isDir()?rmdir($file->getPathname()):unlink($file->getPathname());
        rmdir($directory);
    }
}
