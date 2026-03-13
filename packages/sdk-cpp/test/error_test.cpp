#include <gtest/gtest.h>
#include "alphahuman/error.hpp"

using namespace alphahuman;

TEST(AlphahumanErrorTest, ConstructorSetsFields) {
    AlphahumanError err("test error", 404, "body text");
    EXPECT_EQ(err.status(), 404);
    EXPECT_EQ(std::string(err.what()), "test error");
    EXPECT_EQ(err.body(), "body text");
}

TEST(AlphahumanErrorTest, DefaultEmptyBody) {
    AlphahumanError err("msg", 500);
    EXPECT_EQ(err.status(), 500);
    EXPECT_EQ(err.body(), "");
}

TEST(AlphahumanErrorTest, IsRuntimeError) {
    AlphahumanError err("msg", 500);
    const std::runtime_error* base = &err;
    EXPECT_NE(base, nullptr);
    EXPECT_EQ(std::string(base->what()), "msg");
}
