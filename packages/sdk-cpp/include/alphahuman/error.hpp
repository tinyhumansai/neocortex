#pragma once

#include <stdexcept>
#include <string>

namespace alphahuman {

class AlphahumanError : public std::runtime_error {
public:
    AlphahumanError(const std::string& message, int status, const std::string& body = "")
        : std::runtime_error(message), status_(status), body_(body) {}

    int status() const noexcept { return status_; }
    const std::string& body() const noexcept { return body_; }

private:
    int status_;
    std::string body_;
};

} // namespace alphahuman
