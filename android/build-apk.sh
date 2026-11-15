#!/bin/sh
set -eu

ANDROID_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
export ANDROID_HOME="${ANDROID_HOME:-$ANDROID_DIR/.tooling/android-sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-$ANDROID_DIR/.tooling/gradle-user}"
if [ -z "${JAVA_HOME:-}" ] && [ -x "$ANDROID_DIR/.tooling/jdk-17.0.20.1+1/Contents/Home/bin/java" ]; then
  export JAVA_HOME="$ANDROID_DIR/.tooling/jdk-17.0.20.1+1/Contents/Home"
  export PATH="$JAVA_HOME/bin:$PATH"
fi

cd "$ANDROID_DIR"
./gradlew --no-daemon assembleDebug
mkdir -p dist
cp app/build/outputs/apk/debug/app-debug.apk dist/ninglab-labdesk-debug.apk
printf 'APK: %s\n' "$ANDROID_DIR/dist/ninglab-labdesk-debug.apk"
