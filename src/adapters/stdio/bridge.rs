//! Length-bounded stdio framing; stdout contains protocol frames only.
use crate::{adapters::codec::LIMIT, ReferencedIntent};
use std::io::{self, Read, Write};
pub fn run() -> io::Result<()> {
    let mut owner = ReferencedIntent::new();
    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut input = stdin.lock();
    let mut output = stdout.lock();
    loop {
        let mut header = [0; 4];
        match input.read(&mut header[..1]) {
            Ok(0) => break,
            Ok(_) => {}
            Err(e) => return Err(e),
        }
        if input.read_exact(&mut header[1..]).is_err() {
            break;
        }
        let n = u32::from_be_bytes(header) as usize;
        if !(1..=LIMIT).contains(&n) {
            break;
        }
        let mut bytes = vec![0; n];
        if input.read_exact(&mut bytes).is_err() {
            break;
        }
        let Some(reply) = owner.handle(&bytes) else {
            break;
        };
        output.write_all(&(reply.len() as u32).to_be_bytes())?;
        output.write_all(&reply)?;
        output.flush()?;
        if owner.is_closed() {
            break;
        }
    }
    owner.close();
    Ok(())
}
