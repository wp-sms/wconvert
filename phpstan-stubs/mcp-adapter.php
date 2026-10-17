<?php

/**
 * The MCP Adapter's surface WConvert touches — **stubs for static analysis
 * only, never loaded at runtime** (ADR 0154).
 *
 * The Adapter is a plugin, or WooCommerce's bundled copy, and WConvert never
 * ships it. `Abilities::registerServer()` asks `class_exists()` before using
 * it, so PHPStan needs the shape of the one call made and the three class
 * names passed. Signature from `wordpress/mcp-adapter` 0.1.0.
 */

namespace WP\MCP\Core {
    final class McpAdapter
    {
        /**
         * @param list<class-string> $mcp_transports
         * @param list<string> $tools
         * @param list<mixed> $resources
         * @param list<mixed> $prompts
         * @return self|\WP_Error
         */
        public function create_server(string $server_id, string $server_route_namespace, string $server_route, string $server_name, string $server_description, string $server_version, array $mcp_transports, ?string $error_handler, ?string $observability_handler = null, array $tools = [], array $resources = [], array $prompts = [], ?callable $transport_permission_callback = null)
        {
        }
    }
}

namespace WP\MCP\Transport {
    final class HttpTransport
    {
    }
}

namespace WP\MCP\Infrastructure\ErrorHandling {
    final class ErrorLogMcpErrorHandler
    {
    }
}

namespace WP\MCP\Infrastructure\Observability {
    final class NullMcpObservabilityHandler
    {
    }
}
