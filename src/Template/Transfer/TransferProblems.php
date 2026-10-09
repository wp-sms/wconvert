<?php
namespace WConvert\Template\Transfer;

defined('ABSPATH') || exit;

final class TransferProblems extends \RuntimeException
{
    /**
     * @param array<string, string> $problems */
    public function __construct(public readonly array $problems)
    {
        parent::__construct(__('Some images cannot travel. Return to the editor or explicitly export without them.', 'wconvert'));
    }
}
