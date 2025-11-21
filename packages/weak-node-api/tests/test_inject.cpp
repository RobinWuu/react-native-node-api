#include <catch2/catch_test_macros.hpp>
#include <cstdint>
#include <unordered_map>
#include <weak_node_api.hpp>

TEST_CASE("inject_weak_node_api_host") {
  SECTION("is callable") {
    inject_weak_node_api_host_getter([](node_api_basic_env env) -> NodeApiHost* {
      return nullptr;
    });
  }

  SECTION("test host getter") {
    static bool call_threadsafe_function_called = false;
    auto my_call_threadsafe_function = [](napi_threadsafe_function arg0, void *arg1,
                              napi_threadsafe_function_call_mode arg2) -> napi_status {
      call_threadsafe_function_called = true;
      return napi_status::napi_ok;
    };

    // A dummy create_object function used for test placeholder
    auto dummy_create_object = [](napi_env env,
                               napi_value *result) -> napi_status {
      return napi_status::napi_ok;
    };

    // Default host that binds JS engine-independent APIs, such as napi_call_threadsafe_function, napi_module_register, etc.
    static NodeApiHost sDefaultHost{.napi_call_threadsafe_function = my_call_threadsafe_function,
                                    .napi_create_object = dummy_create_object};

    static bool create_object_called = false;
    auto my_create_object = [](napi_env env,
                               napi_value *result) -> napi_status {
      create_object_called = true;
      return napi_status::napi_ok;
    };
    // A dummy call_threadsafe_function used for test placeholder
    auto dummy_call_threadsafe_function = [](napi_threadsafe_function arg0, void *arg1,
                              napi_threadsafe_function_call_mode arg2) -> napi_status {
      return napi_status::napi_ok;
    };

    // host map used to store mappings from different envs to corresponding hosts
    static std::unordered_map<uint64_t, std::shared_ptr<NodeApiHost>> sMultiHost;

    auto host = std::shared_ptr<NodeApiHost>(new NodeApiHost{.napi_call_threadsafe_function = dummy_call_threadsafe_function,
                                    .napi_create_object = my_create_object});
    napi_env env = reinterpret_cast<napi_env>(0x123);
    sMultiHost[reinterpret_cast<uint64_t>(env)] = host;


    inject_weak_node_api_host_getter([](node_api_basic_env env) -> NodeApiHost* {
      if (env == nullptr) {
        return &sDefaultHost;
      }
      return sMultiHost[reinterpret_cast<uint64_t>(env)].get();
    });

    // test napi_call_threadsafe_function
    napi_threadsafe_function tsfn = reinterpret_cast<napi_threadsafe_function>(0x456);
    napi_call_threadsafe_function(tsfn, nullptr, napi_tsfn_nonblocking);

    REQUIRE(call_threadsafe_function_called);

    // test napi_create_object
    napi_value result;
    napi_create_object(env, &result);

    REQUIRE(create_object_called);
  }

}
