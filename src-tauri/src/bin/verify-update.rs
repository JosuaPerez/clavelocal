use base64::Engine;
use minisign_verify::{PublicKey, Signature};
use std::{env, fs};

fn verify(file: &str, signature_file: &str, key: &str, version: &str) -> Result<(), Box<dyn std::error::Error>> {
    let decode = |value: &str| -> Result<String, Box<dyn std::error::Error>> {
        Ok(String::from_utf8(base64::engine::general_purpose::STANDARD.decode(value.trim())?)?)
    };
    let public = PublicKey::decode(&decode(key)?)?;
    let signature = Signature::decode(&decode(&fs::read_to_string(signature_file)?)?)?;
    public.verify(&fs::read(file)?, &signature, true)?;
    // A trusted comment may only be used after checking the global signature.
    let signed = signature.trusted_comment().split('\t').find_map(|field| field.strip_prefix("version:")).ok_or("La firma no incluye versión")?;
    if semver::Version::parse(signed.trim_start_matches('v'))? != semver::Version::parse(version.trim_start_matches('v'))? {
        return Err("La versión firmada no coincide".into());
    }
    Ok(())
}

fn main() {
    let args: Vec<_> = env::args().skip(1).collect();
    if args.len() != 4 || verify(&args[0], &args[1], &args[2], &args[3]).is_err() {
        eprintln!("Firma o versión no válida");
        std::process::exit(1);
    }
    println!("Firma y versión verificadas");
}
