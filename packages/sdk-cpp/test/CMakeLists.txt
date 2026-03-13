include(FetchContent)

FetchContent_Declare(
    googletest
    GIT_REPOSITORY https://github.com/google/googletest.git
    GIT_TAG        v1.14.0
)
FetchContent_MakeAvailable(googletest)

# Unit tests
add_executable(error_test error_test.cpp)
target_link_libraries(error_test PRIVATE alphahuman GTest::gtest_main)
add_test(NAME error_test COMMAND error_test)

add_executable(memory_client_test memory_client_test.cpp)
target_link_libraries(memory_client_test PRIVATE alphahuman CURL::libcurl GTest::gtest_main)
add_test(NAME memory_client_test COMMAND memory_client_test)

# Integration test
add_executable(integration_test integration_test.cpp)
target_link_libraries(integration_test PRIVATE alphahuman CURL::libcurl GTest::gtest_main)
add_test(NAME integration_test COMMAND integration_test)
