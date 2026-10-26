//! Trusted test mutation helpers, independent of production decode/conversion.
#[derive(Clone, Debug)]
pub enum Value {
    Uint(u64),
    Bytes(Vec<u8>),
}
#[derive(Clone, Debug)]
pub struct Field {
    pub tag: u32,
    pub value: Value,
}
pub fn var(mut value: u64) -> Vec<u8> {
    let mut out = Vec::new();
    loop {
        let byte = (value & 127) as u8;
        value >>= 7;
        out.push(byte | if value == 0 { 0 } else { 128 });
        if value == 0 {
            return out;
        }
    }
}
fn take_var(input: &[u8], at: &mut usize) -> u64 {
    let mut result = 0;
    for shift in (0..70).step_by(7) {
        let b = input[*at];
        *at += 1;
        result |= u64::from(b & 127) << shift;
        if b & 128 == 0 {
            return result;
        }
    }
    panic!("bad trusted test wire")
}
pub fn fields(input: &[u8]) -> Vec<Field> {
    let mut result = Vec::new();
    let mut at = 0;
    while at < input.len() {
        let key = take_var(input, &mut at);
        let tag = (key >> 3) as u32;
        let value = match key & 7 {
            0 => Value::Uint(take_var(input, &mut at)),
            2 => {
                let n = take_var(input, &mut at) as usize;
                let b = input[at..at + n].to_vec();
                at += n;
                Value::Bytes(b)
            }
            _ => panic!("unsupported trusted test wire"),
        };
        result.push(Field { tag, value });
    }
    result
}
pub fn encode(fields: &[Field]) -> Vec<u8> {
    let mut result = Vec::new();
    for field in fields {
        match &field.value {
            Value::Uint(v) => {
                result.extend(var(u64::from(field.tag) << 3));
                result.extend(var(*v));
            }
            Value::Bytes(v) => {
                result.extend(var((u64::from(field.tag) << 3) | 2));
                result.extend(var(v.len() as u64));
                result.extend(v);
            }
        }
    }
    result
}
pub fn bytes(tag: u32, value: Vec<u8>) -> Field {
    Field {
        tag,
        value: Value::Bytes(value),
    }
}
pub fn uint(tag: u32, value: u64) -> Field {
    Field {
        tag,
        value: Value::Uint(value),
    }
}
pub fn framed(magic: &[u8], body: Vec<u8>) -> Vec<u8> {
    let mut out = magic.to_vec();
    out.extend((body.len() as u32).to_be_bytes());
    out.extend(body);
    out
}
pub fn mutate(frame: &[u8], path: &[u32], f: impl FnOnce(&mut Vec<Field>)) -> Vec<u8> {
    fn body(input: &[u8], path: &[u32], f: impl FnOnce(&mut Vec<Field>)) -> Vec<u8> {
        let mut all = fields(input);
        if let Some((tag, rest)) = path.split_first() {
            let field = all
                .iter_mut()
                .find(|x| x.tag == *tag)
                .unwrap_or_else(|| panic!("missing test path {tag} in {path:?}"));
            let Value::Bytes(inner) = &mut field.value else {
                panic!("not a message")
            };
            *inner = body(inner, rest, f);
        } else {
            f(&mut all);
        }
        encode(&all)
    }
    framed(&frame[..4], body(&frame[8..], path, f))
}
