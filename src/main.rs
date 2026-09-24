use std::process::ExitCode;

fn usage() -> ExitCode {
    println!("Usage: changekernel [--help|--version]\nUnqualified bootstrap; no host or worker is available.");
    ExitCode::SUCCESS
}

fn main() -> ExitCode {
    match std::env::args_os().skip(1).collect::<Vec<_>>().as_slice() {
        [] => usage(),
        [arg] if arg == "--help" => usage(),
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
