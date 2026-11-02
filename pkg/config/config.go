// Package config reads required settings from environment variables. Errors name the variable, never its value.
package config

import (
	"fmt"
	"os"
	"strconv"
)

// String returns a required, non-empty environment variable.
func String(name string) (string, error) {
	value := os.Getenv(name)
	if value == "" {
		return "", fmt.Errorf("%s is required", name)
	}
	return value, nil
}

// PositiveInt returns a required environment variable that holds an integer of at least 1.
func PositiveInt(name string) (int, error) {
	value, err := String(name)
	if err != nil {
		return 0, err
	}
	number, err := strconv.Atoi(value)
	if err != nil || number < 1 {
		return 0, fmt.Errorf("%s must be an integer of at least 1", name)
	}
	return number, nil
}
