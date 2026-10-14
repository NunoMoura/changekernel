use std::process::ExitCode;

fn usage() -> ExitCode {
    println!("Usage: changekernel [--help|--version|--referenced-intent-bridge]\nUnqualified source prototype; trusted host required.");
    ExitCode::SUCCESS
}

fn main() -> ExitCode {
    match std::env::args_os().skip(1).collect::<Vec<_>>().as_slice() {
        [] => usage(),
        [arg] if arg == "--help" => usage(),
        #[cfg(target_os = "linux")]
        [arg] if arg == "--referenced-intent-bridge" => {
            match changekernel::referenced_intent_bridge() {
                Ok(()) => ExitCode::SUCCESS,
                Err(_) => ExitCode::FAILURE,
            }
        }
        [arg] if arg == "--version" => {
            println!("changekernel {}", changekernel::VERSION);
            ExitCode::SUCCESS
        }
        _ => {
            eprintln!("Unsupported arguments; run changekernel --help for usage.");
            ExitCode::FAILURE
        }
    }
}
