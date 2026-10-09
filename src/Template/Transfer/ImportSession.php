<?php
namespace WConvert\Template\Transfer;

use WConvert\Template\Catalog\PackValidator;

defined('ABSPATH') || exit;

/**
 * One private, locked, expiring import per administrator and site.
 *
 * ============================================================================
 * WHY THE FILE CALLS HERE ARE PHP'S, AND EACH CARRIES A `phpcs:ignore`.
 * ============================================================================
 * The folder is in the server's temp directory, outside the web root, and
 * WP_Filesystem cannot be trusted to reach it: on an install configured for
 * FTP or SSH it is a remote connection rooted at ABSPATH. Nor does it have
 * the three things this class is made of — an `flock()` that serialises two
 * requests from one administrator, a `rename()` that replaces the session
 * atomically, and owner-only permissions on a directory other accounts on the
 * host can list. Deletion goes through `wp_delete_file()`, which needs none.
 */
final class ImportSession
{
    public const TTL = 1800;
    private readonly string $directory;
    public function __construct(private readonly string $root, string $owner)
    {
        $this->directory = $root . '/' . hash('sha256', $owner);
    }

    public function create(string $archive): string
    {
        return $this->locked(function () use ($archive): string {
            $id = bin2hex(random_bytes(16));
            $staged = $this->directory . '/upload.tmp';
            PackValidator::check(filesize($archive) <= DesignPackage::MAX_ARCHIVE && copy($archive, $staged), __('Could not stage the design file.', 'wconvert'));
            // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_chmod -- owner-only; see the class note.
            chmod($staged, 0600);
            // Invalidate the old preview before changing its archive. A crash can
            // leave unreferenced staging, never an old digest with new contents.
            $this->clear();
            // phpcs:ignore WordPress.WP.AlternativeFunctions.rename_rename -- atomic within one folder; see the class note.
            PackValidator::check(rename($staged, $this->directory . '/upload.zip'), __('Could not stage the design file.', 'wconvert'));
            $this->save(['id' => $id, 'expires' => time() + self::TTL]);
            return $id;
        });
    }

    /**
     * @template T
     *
     * @param callable(array<string, mixed>&, string, callable(): void): T $run
     *
     * @return T
     */
    public function with(string $id, callable $run): mixed
    {
        return $this->locked(function () use ($id, $run): mixed {
            $session = $this->read();
            PackValidator::check(preg_match('/^[a-f0-9]{32}$/D', $id) === 1 && ($session['id'] ?? null) === $id && ($session['expires'] ?? 0) > time(), __('This import has expired or was replaced. Choose the file again.', 'wconvert'));
            $checkpoint = function () use (&$session): void { $this->save($session); };
            try { return $run($session, $this->directory . '/upload.zip', $checkpoint); }
            finally { $this->save($session); }
        });
    }

    /** Read-only image previews can run concurrently without rewriting session state.
     * @template T
     * @param callable(string): T $run
     * @return T
     */
    public function view(string $id, callable $run): mixed
    {
        return $this->locked(function () use ($id, $run): mixed {
            $session = $this->read();
            PackValidator::check(($session['id'] ?? null) === $id && ($session['expires'] ?? 0) > time(), __('This import has expired or was replaced. Choose the file again.', 'wconvert'));
            return $run($this->directory . '/upload.zip');
        }, true);
    }

    public function cancel(string $id): void
    {
        $this->locked(function () use ($id): void {
            if (($this->read()['id'] ?? null) === $id) $this->clear();
        });
    }

    public function expire(): void
    {
        $this->locked(function (): void {
            if (($this->read()['expires'] ?? 0) <= time()) {
                $this->clear();
                if (is_file($this->directory . '/upload.tmp')) wp_delete_file($this->directory . '/upload.tmp');
            }
        });
    }

    /**
     * @template T
     * @param callable(): T $run
     * @return T */
    private function locked(callable $run, bool $readOnly = false): mixed
    {
        foreach ([$this->root, $this->directory] as $folder) {
            // Not wp_mkdir_p(), which copies the parent's permissions — and a
            // shared temp directory's are world-writable. See the class note.
            // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_mkdir -- see above.
            PackValidator::check(!is_link($folder) && (is_dir($folder) || mkdir($folder, 0700, true)), __('Private import storage is unavailable.', 'wconvert'));
            // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_chmod -- owner-only; see the class note.
            chmod($folder, 0700);
        }
        foreach (['lock', 'session.json', 'upload.zip', 'upload.tmp', 'session.tmp'] as $name) PackValidator::check(!is_link($this->directory . '/' . $name), __('Private import storage is unavailable.', 'wconvert'));
        // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen -- a lock handle for flock(); see the class note.
        $lock = fopen($this->directory . '/lock', 'c');
        PackValidator::check($lock !== false, __('Private import storage is unavailable.', 'wconvert'));
        try {
            PackValidator::check(flock($lock, ($readOnly ? LOCK_SH : LOCK_EX) | LOCK_NB), __('Another import operation is running. Try again shortly.', 'wconvert'));
            return $run();
        } finally {
            flock($lock, LOCK_UN);
            // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose -- closes the lock handle opened above.
            fclose($lock);
        }
    }

    /**
     * @return array<string, mixed> */
    private function read(): array
    {
        $path = $this->directory . '/session.json';
        if (!is_file($path)) return [];
        // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- a local file inside this site, never a URL.
        $decoded = json_decode((string) file_get_contents($path), true);
        return is_array($decoded) ? $decoded : [];
    }

    /**
     * @param array<string, mixed> $session */
    private function save(array $session): void
    {
        $json = (string) wp_json_encode($session, JSON_THROW_ON_ERROR);
        $temp = $this->directory . '/session.tmp';
        // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents -- see the class note.
        PackValidator::check(file_put_contents($temp, $json) === strlen($json), __('Could not save import progress.', 'wconvert'));
        // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_chmod -- owner-only; see the class note.
        chmod($temp, 0600);
        // phpcs:ignore WordPress.WP.AlternativeFunctions.rename_rename -- replaces the session atomically; see the class note.
        PackValidator::check(rename($temp, $this->directory . '/session.json'), __('Could not save import progress.', 'wconvert'));
    }

    private function clear(): void
    {
        foreach (['upload.zip', 'session.json', 'session.tmp'] as $name) {
            $path = $this->directory . '/' . $name;
            if (is_file($path) && !is_link($path)) wp_delete_file($path);
        }
    }
}
