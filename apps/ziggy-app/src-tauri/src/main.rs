// Desktop entry point: only used to check and test the shell on a computer.
// The real apps start from `ziggy_app_lib::run` (Android: cdylib, iOS: staticlib).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    ziggy_app_lib::run();
}
