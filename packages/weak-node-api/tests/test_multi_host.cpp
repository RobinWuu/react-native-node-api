#include "js_native_api_types.h"
#include "node_api.h"
#include "node_api_types.h"
#include <catch2/catch_test_macros.hpp>
#include <cstddef>
#include <memory>

#include <NodeApiHost.hpp>
#include <NodeApiMultiHost.hpp>
#include <weak_node_api.hpp>

TEST_CASE("NodeApiMultiHost") {
  SECTION("is injectable") {
    NodeApiMultiHost host{nullptr, nullptr};
    inject_weak_node_api_host(host);
  }

  SECTION("propagates calls to the right napi_create_object") {
    // Setup two hosts
    static size_t foo_calls = 0;
    auto host_foo = std::shared_ptr<NodeApiHost>(new NodeApiHost{
        .napi_create_object = [](napi_env env,
                                 napi_value *result) -> napi_status {
          foo_calls++;
          return napi_status::napi_ok;
        }});

    static size_t bar_calls = 0;
    auto host_bar = std::shared_ptr<NodeApiHost>(new NodeApiHost{
        .napi_create_object = [](napi_env env,
                                 napi_value *result) -> napi_status {
          bar_calls++;
          return napi_status::napi_ok;
        }});

    // Create and inject a multi host and wrap two envs
    NodeApiMultiHost multi_host{nullptr, nullptr};
    inject_weak_node_api_host(multi_host);

    auto foo_env = multi_host.wrap(napi_env{}, host_foo);
    auto bar_env = multi_host.wrap(napi_env{}, host_bar);

    napi_value result;

    REQUIRE(foo_calls == 0);
    REQUIRE(bar_calls == 0);

    REQUIRE(napi_create_object(foo_env, &result) == napi_ok);
    REQUIRE(foo_calls == 1);
    REQUIRE(bar_calls == 0);

    REQUIRE(napi_create_object(bar_env, &result) == napi_ok);
    REQUIRE(foo_calls == 1);
    REQUIRE(bar_calls == 1);
  }

  SECTION("handles multi-host resetting") {
    // Setup two hosts
    static size_t called = 0;
    auto host = std::shared_ptr<NodeApiHost>(new NodeApiHost{
        .napi_create_object = [](napi_env env,
                                 napi_value *result) -> napi_status {
          called++;
          return napi_status::napi_ok;
        }});

    // Create and inject a multi host and wrap two envs
    NodeApiMultiHost multi_host{nullptr, nullptr};
    inject_weak_node_api_host(multi_host);

    auto env = multi_host.wrap(napi_env{}, host);

    napi_value result;
    REQUIRE(called == 0);

    REQUIRE(napi_create_object(env, &result) == napi_ok);
    REQUIRE(called == 1);

    host.reset();
    REQUIRE(napi_create_object(env, &result) == napi_generic_failure);
    REQUIRE(called == 1);
  }

  SECTION("wraps threadsafe functions") {
    // Setup two hosts
    static size_t calls = 0;
    auto host_foo = std::shared_ptr<NodeApiHost>(new NodeApiHost{
        .napi_create_object = [](napi_env env,
                                 napi_value *result) -> napi_status {
          calls++;
          return napi_status::napi_ok;
        },
        .napi_create_threadsafe_function =
            [](napi_env, napi_value, napi_value, napi_value, size_t, size_t,
               void *, napi_finalize, void *, napi_threadsafe_function_call_js,
               napi_threadsafe_function *out) -> napi_status {
          calls++;
          (*out) = {};
          return napi_status::napi_ok;
        },
        .napi_release_threadsafe_function =
            [](napi_threadsafe_function,
               napi_threadsafe_function_release_mode) -> napi_status {
          calls++;
          return napi_status::napi_ok;
        }});

    // Create and inject a multi host and wrap two envs
    NodeApiMultiHost multi_host{nullptr, nullptr};
    inject_weak_node_api_host(multi_host);

    auto foo_env = multi_host.wrap(napi_env{}, host_foo);

    {
      napi_threadsafe_function result;

      REQUIRE(calls == 0);

      REQUIRE(napi_create_threadsafe_function(
                  foo_env, nullptr, nullptr, nullptr, 0, 0, nullptr, nullptr,
                  nullptr, nullptr, &result) == napi_ok);
      REQUIRE(calls == 1);

      REQUIRE(napi_release_threadsafe_function(
                  result,
                  napi_threadsafe_function_release_mode::napi_tsfn_release) ==
              napi_ok);
      REQUIRE(calls == 2);
    }
  }

  SECTION("wraps async cleanup hook handles") {
    // Setup two hosts
    static size_t calls = 0;
    auto host_foo = std::shared_ptr<NodeApiHost>(new NodeApiHost{
        .napi_create_object = [](napi_env env,
                                 napi_value *result) -> napi_status {
          calls++;
          return napi_status::napi_ok;
        },
        .napi_add_async_cleanup_hook =
            [](node_api_basic_env env, napi_async_cleanup_hook hook, void *arg,
               napi_async_cleanup_hook_handle *remove_handle) -> napi_status {
          calls++;
          (*remove_handle) = {};
          return napi_status::napi_ok;
        },
        .napi_remove_async_cleanup_hook =
            [](napi_async_cleanup_hook_handle remove_handle) -> napi_status {
          calls++;
          return napi_status::napi_ok;
        }});

    // Create and inject a multi host and wrap two envs
    NodeApiMultiHost multi_host{nullptr, nullptr};
    inject_weak_node_api_host(multi_host);

    auto foo_env = multi_host.wrap(napi_env{}, host_foo);

    {
      napi_async_cleanup_hook_handle result;

      REQUIRE(calls == 0);

      REQUIRE(napi_add_async_cleanup_hook(foo_env, nullptr, nullptr, &result) ==
              napi_ok);
      REQUIRE(calls == 1);

      REQUIRE(napi_remove_async_cleanup_hook(result) == napi_ok);
      REQUIRE(calls == 2);
    }
  }

  SECTION("how to get wrapped env in napi_callback") {
    // Create and inject a multi-host, then wrap two envs
    NodeApiMultiHost multi_host{nullptr, nullptr};
    inject_weak_node_api_host(multi_host);

    auto host_foo = std::shared_ptr<NodeApiHost>(new NodeApiHost{
        .napi_create_function =
            [](napi_env env, const char* utf8name, size_t length, napi_callback cb,
              void* callback_data, napi_value* result) -> napi_status {
          // This is the specific implementation of napi_create_function in various engines, such as hermes, PrimJS, V8, JSC
          // Here, a engine-specific callback is registered with the JS engine. When a user calls the JS function from the JS side, this callback is triggered. Then, napi_callback is triggered within this callback.
          // When triggering the execution of napi_callback, napi_env needs to be passed. Usually, in the implementation of each engine, raw_env is passed. However, with raw_env, users cannot call weak-node-api's API 
          // within napi_callback. If we pass wrapped env, we need to be able to get wrapped env here, which would couple the engine implementation with weak-node-api.
          // For example, here is primjs's napi_create_function implementation code: https://github.com/lynx-family/primjs/blob/develop/src/napi/quickjs/js_native_api_QuickJS.cc#L661
          
          return napi_ok;
        }});

    // Original napi_env
    napi_env raw_env{};
    // foo_env is a WrappedEnv
    auto foo_env = multi_host.wrap(napi_env{}, host_foo);

    napi_callback foo_cb = [](napi_env env, napi_callback_info info) -> napi_value {
      // This `env` is not the WrappedEnv foo_env, but the original napi_env raw_env.
      // Therefore, cannot directly call weak-node-api functions here because napi_env is not a wrapped env.
      // We also cannot try to get the host from napi_callback_info, as users are not aware of the internal implementation details of weak-node-api.
      return nullptr;
    };

    napi_value foo_fn = nullptr;
    napi_create_function(foo_env, "foo", 3, foo_cb, nullptr, &foo_fn);
  }
}
