"""Approval-safe orchestration for private autostereogram candidates."""
from __future__ import annotations

import fcntl
import hashlib
import io
import json
import os
import re
import secrets
import stat
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Callable, Iterator, Mapping, cast

from PIL import Image

from .analysis import analyse_article, select_hidden_object
from .config import load_autostereogram_config
from .depth_maps import generate_depth_map
from .manifest import build_manifest
from .models import ArticlePacket, AutostereogramConfig, RenderSpec
from .planner import build_render_spec
from .qa import validate_autostereogram
from .seeds import derive_article_seed
from .source import build_article_packet
from .stereogram import render_autostereogram


class CandidateOutputError(ValueError):
    """Candidate output violates the private-root contract."""


class ExistingCandidate(CandidateOutputError):
    """A candidate bundle already exists and replacement was not approved."""


class CandidateQAError(ValueError):
    """The rendered candidate did not pass computational QA."""


_HEX_64 = re.compile(r"[0-9a-f]{64}")
_HEX_16 = re.compile(r"[0-9a-f]{16}")
_CANDIDATE_FILE = re.compile(r"candidate-v([1-9][0-9]*)\.(png|webp)")
_SAFE_DIRECTORY = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")


def _absolute(path: Path) -> Path:
    return Path(os.path.abspath(path))


def _is_hex(value: object, pattern: re.Pattern[str]) -> bool:
    return isinstance(value, str) and pattern.fullmatch(value) is not None


def _validate_private_output(
    output_dir: Path,
    candidate_root: Path,
    repository_root: Path,
) -> Path:
    lexical_repository = _absolute(repository_root)
    lexical_root = _absolute(candidate_root)
    lexical_output = _absolute(output_dir)
    try:
        root_parts = lexical_root.relative_to(lexical_repository).parts
    except ValueError as exc:
        raise CandidateOutputError("configured private Design root must remain in the repository") from exc
    current = lexical_repository
    for part in root_parts:
        current /= part
        if current.is_symlink():
            raise CandidateOutputError("configured private Design root may not contain symlinks")
    if lexical_output.parent != lexical_root:
        raise CandidateOutputError(
            "candidate output must be one direct article-slug child of the configured private Design root"
        )
    if lexical_output.exists() and lexical_output.is_symlink():
        raise CandidateOutputError("candidate output directory may not be a symlink")
    return lexical_output


def _existing_hashes(
    candidate_root: Path,
    *,
    exclude_report: Path | None = None,
) -> tuple[tuple[str, ...], tuple[str, ...]]:
    try:
        root_descriptor = _open_checked_directory(candidate_root)
    except FileNotFoundError:
        return (), ()
    try:
        return _existing_hashes_at(
            root_descriptor,
            exclude_article=exclude_report.parent.name if exclude_report is not None else None,
            exclude_filename=exclude_report.name if exclude_report is not None else None,
        )
    finally:
        os.close(root_descriptor)


def _image_bytes(image: Image.Image, format_name: str) -> bytes:
    handle = io.BytesIO()
    if format_name == "png":
        image.save(handle, format="PNG", optimize=False, compress_level=9)
    elif format_name == "webp":
        image.save(handle, format="WEBP", lossless=True, quality=100, method=6)
    else:
        raise ValueError(f"unsupported output format: {format_name}")
    return handle.getvalue()


def _open_checked_directory(path: Path) -> int:
    flags = os.O_RDONLY | getattr(os, "O_DIRECTORY", 0) | getattr(os, "O_NOFOLLOW", 0)
    descriptor = os.open(path, flags)
    opened = os.fstat(descriptor)
    current = os.stat(path, follow_symlinks=False)
    if not stat.S_ISDIR(opened.st_mode) or (opened.st_dev, opened.st_ino) != (current.st_dev, current.st_ino):
        os.close(descriptor)
        raise CandidateOutputError("candidate directory changed while it was being opened")
    return descriptor


def _open_or_create_descendant(base: Path, target: Path, *, create: bool = True) -> int:
    lexical_base = _absolute(base)
    lexical_target = _absolute(target)
    try:
        components = lexical_target.relative_to(lexical_base).parts
    except ValueError as exc:
        raise CandidateOutputError("candidate directory must remain beneath the repository") from exc
    descriptor = _open_checked_directory(lexical_base)
    try:
        for component in components:
            if component in {"", ".", ".."}:
                raise CandidateOutputError("candidate directory contains an unsafe component")
            if create:
                try:
                    os.mkdir(component, mode=0o700, dir_fd=descriptor)
                except FileExistsError:
                    pass
            flags = os.O_RDONLY | getattr(os, "O_DIRECTORY", 0) | getattr(os, "O_NOFOLLOW", 0)
            child_descriptor = os.open(component, flags, dir_fd=descriptor)
            child = os.fstat(child_descriptor)
            current = os.stat(component, dir_fd=descriptor, follow_symlinks=False)
            if not stat.S_ISDIR(child.st_mode) or (child.st_dev, child.st_ino) != (current.st_dev, current.st_ino):
                os.close(child_descriptor)
                raise CandidateOutputError("candidate directory changed while it was being traversed")
            os.close(descriptor)
            descriptor = child_descriptor
        return descriptor
    except Exception:
        os.close(descriptor)
        raise


def _read_regular_file(
    directory_descriptor: int,
    filename: str,
    *,
    maximum_bytes: int,
) -> bytes:
    if not filename or "/" in filename or filename in {".", ".."}:
        raise CandidateOutputError("candidate filename is unsafe")
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
    try:
        descriptor = os.open(filename, flags, dir_fd=directory_descriptor)
    except OSError as exc:
        raise CandidateOutputError(f"candidate file is missing or unsafe: {filename}") from exc
    try:
        metadata = os.fstat(descriptor)
        if not stat.S_ISREG(metadata.st_mode) or metadata.st_size > maximum_bytes:
            raise CandidateOutputError(f"candidate file is not a safe regular file: {filename}")
        with os.fdopen(descriptor, "rb", closefd=False) as handle:
            return handle.read()
    finally:
        os.close(descriptor)


@contextmanager
def _candidate_root_lock(
    config: AutostereogramConfig,
    *,
    exclusive: bool,
) -> Iterator[int]:
    try:
        root_descriptor = _open_or_create_descendant(
            config.root,
            config.candidate_root,
            create=exclusive,
        )
    except OSError as exc:
        raise CandidateOutputError("private candidate root is missing or unsafe") from exc
    try:
        operation = fcntl.LOCK_EX if exclusive else fcntl.LOCK_SH
        fcntl.flock(root_descriptor, operation)
        yield root_descriptor
    finally:
        fcntl.flock(root_descriptor, fcntl.LOCK_UN)
        os.close(root_descriptor)


def _entry_exists(directory_descriptor: int, filename: str) -> bool:
    try:
        os.stat(filename, dir_fd=directory_descriptor, follow_symlinks=False)
        return True
    except FileNotFoundError:
        return False


def _assert_path_identity(path: Path, descriptor: int) -> None:
    try:
        current = os.stat(path, follow_symlinks=False)
    except OSError as exc:
        raise CandidateOutputError("candidate root moved during the transaction") from exc
    opened = os.fstat(descriptor)
    if not stat.S_ISDIR(current.st_mode) or (current.st_dev, current.st_ino) != (opened.st_dev, opened.st_ino):
        raise CandidateOutputError("candidate root changed during the transaction")


def _assert_child_identity(parent_descriptor: int, name: str, descriptor: int) -> None:
    try:
        current = os.stat(name, dir_fd=parent_descriptor, follow_symlinks=False)
    except OSError as exc:
        raise CandidateOutputError("candidate article directory moved during the transaction") from exc
    opened = os.fstat(descriptor)
    if not stat.S_ISDIR(current.st_mode) or (current.st_dev, current.st_ino) != (opened.st_dev, opened.st_ino):
        raise CandidateOutputError("candidate article directory changed during the transaction")


def _open_child_directory(parent_descriptor: int, name: str, *, create: bool) -> int:
    if _SAFE_DIRECTORY.fullmatch(name) is None:
        raise CandidateOutputError("candidate directory name is unsafe")
    if create:
        try:
            os.mkdir(name, mode=0o700, dir_fd=parent_descriptor)
        except FileExistsError:
            pass
    flags = os.O_RDONLY | getattr(os, "O_DIRECTORY", 0) | getattr(os, "O_NOFOLLOW", 0)
    try:
        descriptor = os.open(name, flags, dir_fd=parent_descriptor)
    except OSError as exc:
        raise CandidateOutputError("candidate article directory is missing or unsafe") from exc
    opened = os.fstat(descriptor)
    current = os.stat(name, dir_fd=parent_descriptor, follow_symlinks=False)
    if not stat.S_ISDIR(opened.st_mode) or (opened.st_dev, opened.st_ino) != (current.st_dev, current.st_ino):
        os.close(descriptor)
        raise CandidateOutputError("candidate article directory changed while it was opened")
    return descriptor


def _existing_hashes_at(
    root_descriptor: int,
    *,
    exclude_article: str | None = None,
    exclude_filename: str | None = None,
) -> tuple[tuple[str, ...], tuple[str, ...]]:
    pixel_hashes: list[str] = []
    perceptual_hashes: list[str] = []
    for article_name in os.listdir(root_descriptor):
        if _SAFE_DIRECTORY.fullmatch(article_name) is None:
            continue
        try:
            article_descriptor = _open_child_directory(root_descriptor, article_name, create=False)
        except CandidateOutputError:
            continue
        try:
            for filename in os.listdir(article_descriptor):
                if not filename.endswith(".qa.json"):
                    continue
                if article_name == exclude_article and filename == exclude_filename:
                    continue
                try:
                    report_bytes = _read_regular_file(
                        article_descriptor,
                        filename,
                        maximum_bytes=1_000_000,
                    )
                    data = json.loads(report_bytes.decode("utf-8"))
                except (CandidateOutputError, UnicodeError, json.JSONDecodeError):
                    continue
                if not isinstance(data, dict):
                    continue
                value = data.get("decoded_pixel_sha256")
                if _is_hex(value, _HEX_64):
                    pixel_hashes.append(str(value))
                perceptual = data.get("perceptual_dhash")
                if _is_hex(perceptual, _HEX_16):
                    perceptual_hashes.append(str(perceptual))
        finally:
            os.close(article_descriptor)
    return tuple(pixel_hashes), tuple(perceptual_hashes)


def _atomic_bundle_at(
    directory_descriptor: int,
    files: Mapping[str, bytes],
    *,
    force: bool,
    guard: Callable[[], None] | None = None,
) -> None:
    if not files or any(not name or "/" in name or name in {".", ".."} for name in files):
        raise CandidateOutputError("candidate bundle filenames are invalid")
    check_guard = guard or (lambda: None)
    check_guard()
    if not force:
        existing = next((name for name in files if _entry_exists(directory_descriptor, name)), None)
        if existing is not None:
            raise ExistingCandidate(f"candidate bundle already exists: {existing}")

    temporaries: dict[str, str] = {}
    backups: dict[str, str] = {}
    installed: list[str] = []
    created: list[str] = []
    try:
        for name, data in files.items():
            temporary = f".{name}.{secrets.token_hex(12)}.tmp"
            flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0)
            descriptor = os.open(temporary, flags, 0o600, dir_fd=directory_descriptor)
            temporaries[name] = temporary
            try:
                handle = os.fdopen(descriptor, "wb")
            except Exception:
                os.close(descriptor)
                raise
            with handle:
                handle.write(data)
                handle.flush()
                os.fsync(handle.fileno())

        check_guard()
        if force:
            for name in files:
                if _entry_exists(directory_descriptor, name):
                    backup = f".{name}.{secrets.token_hex(12)}.backup"
                    os.replace(
                        name,
                        backup,
                        src_dir_fd=directory_descriptor,
                        dst_dir_fd=directory_descriptor,
                    )
                    backups[name] = backup
            for name in files:
                check_guard()
                os.replace(
                    temporaries[name],
                    name,
                    src_dir_fd=directory_descriptor,
                    dst_dir_fd=directory_descriptor,
                )
                installed.append(name)
        else:
            for name in files:
                check_guard()
                try:
                    os.link(
                        temporaries[name],
                        name,
                        src_dir_fd=directory_descriptor,
                        dst_dir_fd=directory_descriptor,
                        follow_symlinks=False,
                    )
                except FileExistsError as exc:
                    raise ExistingCandidate(f"candidate bundle already exists: {name}") from exc
                created.append(name)
        check_guard()
        os.fsync(directory_descriptor)
        check_guard()
    except Exception:
        for name in installed + created:
            try:
                os.unlink(name, dir_fd=directory_descriptor)
            except FileNotFoundError:
                pass
        for name, backup in backups.items():
            if _entry_exists(directory_descriptor, backup):
                os.replace(
                    backup,
                    name,
                    src_dir_fd=directory_descriptor,
                    dst_dir_fd=directory_descriptor,
                )
        os.fsync(directory_descriptor)
        raise
    else:
        for backup in backups.values():
            os.unlink(backup, dir_fd=directory_descriptor)
        os.fsync(directory_descriptor)
    finally:
        for temporary in temporaries.values():
            try:
                os.unlink(temporary, dir_fd=directory_descriptor)
            except FileNotFoundError:
                pass


def _atomic_bundle(
    files: Mapping[Path, bytes],
    *,
    force: bool,
    trusted_root: Path | None = None,
    repository_root: Path | None = None,
) -> None:
    destinations = tuple(files)
    if not destinations:
        raise CandidateOutputError("candidate bundle may not be empty")
    parents = {path.parent for path in destinations}
    if len(parents) != 1:
        raise CandidateOutputError("candidate bundle files must share one directory")
    parent = _absolute(next(iter(parents)))
    if any(path.name != path.as_posix().rsplit("/", 1)[-1] for path in destinations):
        raise CandidateOutputError("candidate bundle destinations must be simple filenames")

    directory_descriptor: int | None = None
    try:
        if trusted_root is None:
            parent.mkdir(parents=True, exist_ok=True)
            if parent.is_symlink():
                raise CandidateOutputError("candidate output directory may not be a symlink")
            directory_descriptor = _open_checked_directory(parent)
        else:
            lexical_root = _absolute(trusted_root)
            if parent.parent != lexical_root:
                raise CandidateOutputError("candidate bundle directory must be a direct child of its trusted root")
            if repository_root is None:
                raise CandidateOutputError("repository root is required for a trusted candidate write")
            directory_descriptor = _open_or_create_descendant(repository_root, parent)

        assert directory_descriptor is not None
        _atomic_bundle_at(
            directory_descriptor,
            {destination.name: data for destination, data in files.items()},
            force=force,
        )
    finally:
        if directory_descriptor is not None:
            os.close(directory_descriptor)


def _verify_existing_bundle_owner_at(
    directory_descriptor: int,
    destinations: tuple[str, ...],
    render_name: str,
    packet: ArticlePacket,
    expected_formats: tuple[str, ...],
) -> None:
    if not any(_entry_exists(directory_descriptor, name) for name in destinations):
        return
    try:
        manifest_bytes = _read_regular_file(
            directory_descriptor,
            render_name,
            maximum_bytes=1_000_000,
        )
        manifest = json.loads(manifest_bytes.decode("utf-8"))
        source = manifest["source"]
        article_id = source["article_id"]
        source_sha256 = source["source_sha256"]
        outputs = manifest["outputs"]
    except (CandidateOutputError, UnicodeError, json.JSONDecodeError, KeyError, TypeError) as exc:
        raise CandidateOutputError("cannot establish ownership of the existing candidate bundle") from exc
    if article_id != packet.article_id or source_sha256 != packet.source_sha256:
        raise CandidateOutputError("existing candidate bundle belongs to a different source")
    if not isinstance(outputs, dict) or set(outputs) != set(expected_formats):
        raise CandidateOutputError("forced replacement must use the existing bundle's output formats")


def generate_candidate(
    source_path: Path,
    *,
    root: Path,
    config: AutostereogramConfig | None = None,
    output_dir: Path | None = None,
    variant_number: int = 0,
    output_format: str = "png",
    force: bool = False,
    dry_run: bool = False,
    manifest_only: bool = False,
) -> dict[str, object]:
    config = config or load_autostereogram_config(root)
    packet = build_article_packet(source_path, root=root, config=config)
    requested = output_dir or config.candidate_root / packet.slug
    requested = requested if requested.is_absolute() else root / requested
    private_output = _validate_private_output(requested, config.candidate_root, config.root)
    seed = derive_article_seed(packet, config.renderer_version, variant_number=variant_number)
    analysis = analyse_article(packet, config)
    selection = select_hidden_object(packet, analysis, config, seed=seed)
    spec = build_render_spec(
        packet,
        analysis,
        selection,
        config,
        seed=seed,
        variant_number=variant_number,
    )
    base = f"candidate-v{variant_number + 1}"
    formats = ("png", "webp") if output_format == "both" else (output_format,)
    if any(value not in {"png", "webp"} for value in formats):
        raise CandidateOutputError("output_format must be png, webp or both")
    image_paths = {format_name: private_output / f"{base}.{format_name}" for format_name in formats}
    render_path = private_output / f"{base}.render.json"
    qa_path = private_output / f"{base}.qa.json"
    complete_bundle_names = (
        f"{base}.png",
        f"{base}.webp",
        render_path.name,
        qa_path.name,
    )

    planned = {
        "status": "manifest-only" if manifest_only else "dry-run",
        "article": packet.article_id,
        "output_dir": str(private_output),
        "render_spec": spec.to_dict(),
        "hidden_object": selection.hidden_object_id,
        "alt_text": f"Colourful 1990s-style autostereogram containing a hidden 3D {selection.alt_label}.",
    }
    if dry_run or manifest_only:
        return planned

    depth = generate_depth_map(selection.depth_map_id, config)
    image = render_autostereogram(depth, spec, config)
    with _candidate_root_lock(config, exclusive=True) as root_descriptor:
        article_descriptor = _open_child_directory(
            root_descriptor,
            private_output.name,
            create=True,
        )
        try:
            def transaction_guard() -> None:
                _assert_path_identity(config.candidate_root, root_descriptor)
                _assert_child_identity(root_descriptor, private_output.name, article_descriptor)

            transaction_guard()
            if not force:
                existing = next(
                    (name for name in complete_bundle_names if _entry_exists(article_descriptor, name)),
                    None,
                )
                if existing is not None:
                    raise ExistingCandidate(f"candidate bundle already exists: {existing}")
            else:
                _verify_existing_bundle_owner_at(
                    article_descriptor,
                    complete_bundle_names,
                    render_path.name,
                    packet,
                    formats,
                )
            existing_pixels, existing_perceptual = _existing_hashes_at(
                root_descriptor,
                exclude_article=private_output.name if force else None,
                exclude_filename=qa_path.name if force else None,
            )
            transaction_guard()
            qa = validate_autostereogram(
                image,
                depth,
                spec,
                existing_pixel_hashes=existing_pixels,
                existing_perceptual_hashes=existing_perceptual,
            )
            if not qa.get("passed"):
                raise CandidateQAError(f"candidate failed QA: {json.dumps(qa.get('checks'), sort_keys=True)}")

            encoded_images = {format_name: _image_bytes(image, format_name) for format_name in formats}
            outputs: dict[str, dict[str, object]] = {}
            for format_name, data in encoded_images.items():
                outputs[format_name] = {
                    "filename": image_paths[format_name].name,
                    "sha256": hashlib.sha256(data).hexdigest(),
                    "bytes": len(data),
                }
            manifest = build_manifest(packet, analysis, selection, spec, qa, outputs)
            payloads = {
                image_paths[format_name].name: data
                for format_name, data in encoded_images.items()
            }
            payloads[render_path.name] = (
                json.dumps(manifest, indent=2, sort_keys=True) + "\n"
            ).encode("utf-8")
            payloads[qa_path.name] = (json.dumps(qa, indent=2, sort_keys=True) + "\n").encode("utf-8")
            _atomic_bundle_at(
                article_descriptor,
                payloads,
                force=force,
                guard=transaction_guard,
            )
        finally:
            os.close(article_descriptor)
    primary = image_paths[formats[0]]
    return {
        "status": "qa-passed",
        "article": packet.article_id,
        "image": str(primary),
        "images": {key: str(value) for key, value in image_paths.items()},
        "render_manifest": str(render_path),
        "qa_report": str(qa_path),
        "hidden_object": selection.hidden_object_id,
        "alt_text": planned["alt_text"],
        "qa": qa,
    }


def _required_mapping(
    value: object,
    name: str,
    expected_keys: set[str] | None = None,
) -> Mapping[str, object]:
    if not isinstance(value, dict):
        raise ValueError(f"{name} must be an object")
    if expected_keys is not None and set(value) != expected_keys:
        raise ValueError(f"{name} fields do not match the approved schema")
    return value


def _manifest_number(value: object, name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{name} must be a number")
    number = float(value)
    if not 0.0 <= number <= 1.0:
        raise ValueError(f"{name} must be between zero and one")
    return number


def _manifest_text_list(value: object, name: str) -> tuple[str, ...]:
    if not isinstance(value, list) or not all(isinstance(item, str) and item for item in value):
        raise ValueError(f"{name} must contain only text values")
    return tuple(cast(list[str], value))


def _validated_manifest(
    manifest_value: object,
    image_path: Path,
    config: AutostereogramConfig,
) -> tuple[RenderSpec, str, Mapping[str, object], Mapping[str, object]]:
    manifest = _required_mapping(
        manifest_value,
        "manifest",
        {"schema", "approval_state", "source", "analysis", "selection", "render_spec", "outputs", "qa"},
    )
    if manifest.get("schema") != "DADBOT_AUTOSTEREOGRAM_MANIFEST_V1":
        raise ValueError("unsupported manifest schema")
    if manifest.get("approval_state") != "private-design-candidate":
        raise ValueError("candidate is not in the private approval state")

    filename_match = _CANDIDATE_FILE.fullmatch(image_path.name)
    if filename_match is None:
        raise ValueError("candidate filename is invalid")
    file_variant = int(filename_match.group(1)) - 1
    file_format = filename_match.group(2)

    render_data = _required_mapping(manifest.get("render_spec"), "render_spec")
    if set(render_data) != set(RenderSpec.__dataclass_fields__):
        raise ValueError("render_spec fields do not match the current schema")
    integer_fields = (
        "seed",
        "variant_number",
        "width",
        "height",
        "repeat_width_px",
        "maximum_disparity_px",
    )
    if any(type(render_data.get(field)) is not int for field in integer_fields):
        raise ValueError("render_spec integer fields are invalid")
    string_fields = (
        "schema",
        "article_id",
        "article_hash",
        "section",
        "renderer_version",
        "convention",
        "hidden_object_id",
        "primary_topic",
        "palette_id",
        "texture_id",
    )
    if any(not isinstance(render_data.get(field), str) for field in string_fields):
        raise ValueError("render_spec text fields are invalid")
    safe_area = render_data.get("safe_area")
    if isinstance(safe_area, bool) or not isinstance(safe_area, (int, float)):
        raise ValueError("render_spec safe_area is invalid")
    spec = RenderSpec(
        schema=str(render_data["schema"]),
        article_id=str(render_data["article_id"]),
        article_hash=str(render_data["article_hash"]),
        section=str(render_data["section"]),
        primary_topic=str(render_data["primary_topic"]),
        hidden_object_id=str(render_data["hidden_object_id"]),
        palette_id=str(render_data["palette_id"]),
        texture_id=str(render_data["texture_id"]),
        seed=cast(int, render_data["seed"]),
        renderer_version=str(render_data["renderer_version"]),
        width=cast(int, render_data["width"]),
        height=cast(int, render_data["height"]),
        repeat_width_px=cast(int, render_data["repeat_width_px"]),
        maximum_disparity_px=cast(int, render_data["maximum_disparity_px"]),
        convention=str(render_data["convention"]),
        safe_area=float(cast(float, safe_area)),
        variant_number=cast(int, render_data["variant_number"]),
    )
    if spec.schema != "AUTOSTEREOGRAM_RENDER_SPEC_V1":
        raise ValueError("render specification schema is not approved")
    if spec.renderer_version != config.renderer_version:
        raise ValueError("renderer version is not current")
    if spec.variant_number != file_variant or spec.variant_number < 0 or spec.seed < 0:
        raise ValueError("variant or seed is invalid")
    if (spec.width, spec.height) != (config.width, config.height):
        raise ValueError("candidate dimensions are not approved")
    if spec.convention != config.default_convention or spec.convention != "parallel":
        raise ValueError("stereogram convention is not approved")
    if spec.repeat_width_px != config.repeat_width_px:
        raise ValueError("repeat width is not approved")
    if float(spec.safe_area) != config.safe_area:
        raise ValueError("safe area is not approved")
    if not _is_hex(spec.article_hash, _HEX_64):
        raise ValueError("article hash is invalid")

    source = _required_mapping(
        manifest.get("source"),
        "source",
        {"article_id", "source_path", "source_sha256", "workflow_stage", "publishable"},
    )
    section = spec.section
    if section not in config.supported_sections:
        raise ValueError("source section is not approved")
    if source.get("article_id") != spec.article_id or source.get("source_sha256") != spec.article_hash:
        raise ValueError("source identity does not match render_spec")
    if not spec.article_id.startswith(f"{section}:"):
        raise ValueError("article identifier does not match its section")
    source_path = source.get("source_path")
    if not isinstance(source_path, str):
        raise ValueError("source path must be text")
    source_parts = Path(source_path).parts
    if (
        Path(source_path).is_absolute()
        or not source_parts
        or any(part in {"", ".", ".."} for part in source_parts)
        or Path(source_path).suffix.casefold() != ".md"
    ):
        raise ValueError("source path is not a safe repository-relative Markdown path")
    workflow_stage = source.get("workflow_stage")
    publishable = source.get("publishable")
    if type(publishable) is not bool:
        raise ValueError("source publishable flag must be boolean")
    if source_parts[0] == "content":
        if (
            len(source_parts) < 3
            or source_parts[1] != section
            or workflow_stage != "published"
            or publishable is not True
        ):
            raise ValueError("public source provenance is invalid")
    elif source_parts[0] == "05-Reviews":
        if workflow_stage != "proofread" or publishable is not False:
            raise ValueError("proofread source provenance is invalid")
    elif source_parts[0] == "06-Design":
        if workflow_stage != "design" or publishable is not False:
            raise ValueError("design source provenance is invalid")
    else:
        raise ValueError("source path is outside an approved provenance root")

    analysis = _required_mapping(
        manifest.get("analysis"),
        "analysis",
        {"primary_topic", "matched_terms", "confidence", "method", "safety_constraints"},
    )
    if analysis.get("primary_topic") != spec.primary_topic:
        raise ValueError("analysis topic does not match render_spec")
    matched_terms = _manifest_text_list(analysis.get("matched_terms"), "analysis matched_terms")
    safety_constraints = _manifest_text_list(
        analysis.get("safety_constraints"),
        "analysis safety_constraints",
    )
    analysis_confidence = _manifest_number(analysis.get("confidence"), "analysis confidence")
    if analysis.get("method") not in {"deterministic", "fallback"}:
        raise ValueError("analysis method is invalid")
    topic_entry = _required_mapping(config.topics.get(spec.primary_topic), "topic config")
    aliases = topic_entry.get("aliases")
    topic_constraints = topic_entry.get("safety_constraints")
    if not isinstance(aliases, list) or not set(matched_terms).issubset(set(cast(list[str], aliases))):
        raise ValueError("analysis matched terms are not configured aliases")
    configured_constraints = set(cast(list[str], topic_constraints)) if isinstance(topic_constraints, list) else set()
    configured_constraints.update(
        {
            "Preserve proposal, internal approval, civilian authorisation and execution as separate states.",
            "Do not turn preliminary findings, allegations or possible outcomes into settled facts.",
        }
    )
    if not set(safety_constraints).issubset(configured_constraints):
        raise ValueError("analysis safety constraints are not allowlisted")

    selection = _required_mapping(
        manifest.get("selection"),
        "selection",
        {"hidden_object_id", "depth_map_id", "alt_label", "reason", "confidence"},
    )
    hidden_object_id = selection.get("hidden_object_id")
    depth_map_id = selection.get("depth_map_id")
    if hidden_object_id != spec.hidden_object_id or depth_map_id != spec.hidden_object_id:
        raise ValueError("object selection does not match render_spec")
    if not isinstance(depth_map_id, str) or depth_map_id not in config.depth_maps:
        raise ValueError("depth map is not allowlisted")
    depth_entry = _required_mapping(config.depth_maps[depth_map_id], "depth map config")
    if selection.get("alt_label") != depth_entry.get("alt_label"):
        raise ValueError("selection alt label is not the configured label")
    if selection.get("reason") not in {
        "deterministic topic mapping",
        "explicit approved Design override",
        "section fallback for low-confidence topic",
        "section fallback for unknown topic",
        "section fallback because mapped objects were unsafe",
    }:
        raise ValueError("selection reason is invalid")
    if _manifest_number(selection.get("confidence"), "selection confidence") != analysis_confidence:
        raise ValueError("selection confidence does not match analysis")
    safe_sections = depth_entry.get("safe_sections")
    if not isinstance(safe_sections, list) or section not in safe_sections:
        raise ValueError("hidden object is not approved for this section")
    minimum = depth_entry.get("minimum_disparity_px")
    maximum = depth_entry.get("maximum_disparity_px")
    if type(minimum) is not int or type(maximum) is not int:
        raise ValueError("depth disparity bounds are invalid")
    minimum_px = cast(int, minimum)
    maximum_px = cast(int, maximum)
    if not minimum_px <= spec.maximum_disparity_px <= min(maximum_px, config.maximum_disparity_px):
        raise ValueError("maximum disparity is outside the approved range")
    if spec.palette_id not in config.section_palettes[str(section)]:
        raise ValueError("palette is not allowlisted for this section")
    if spec.texture_id not in config.section_textures[str(section)]:
        raise ValueError("texture is not allowlisted for this section")
    if spec.primary_topic not in config.topics:
        raise ValueError("primary topic is not allowlisted")

    outputs = _required_mapping(manifest.get("outputs"), "outputs")
    if not outputs or not set(outputs).issubset({"png", "webp"}) or file_format not in outputs:
        raise ValueError("manifest outputs are invalid")
    expected_base = f"candidate-v{file_variant + 1}"
    for format_name, record_value in outputs.items():
        record = _required_mapping(
            record_value,
            f"outputs.{format_name}",
            {"filename", "sha256", "bytes"},
        )
        if record.get("filename") != f"{expected_base}.{format_name}":
            raise ValueError("manifest output filename is invalid")
        if not _is_hex(record.get("sha256"), _HEX_64):
            raise ValueError("manifest output hash is invalid")
        byte_count = record.get("bytes")
        if type(byte_count) is not int or cast(int, byte_count) <= 0:
            raise ValueError("manifest output byte count is invalid")
    qa = _required_mapping(
        manifest.get("qa"),
        "qa",
        {
            "passed",
            "decoded_pixel_sha256",
            "perceptual_dhash",
            "near_duplicate_warning",
            "nearest_perceptual_hamming_distance",
            "checks",
        },
    )
    if qa.get("passed") is not True:
        raise ValueError("manifest QA did not pass")
    if not _is_hex(qa.get("decoded_pixel_sha256"), _HEX_64):
        raise ValueError("manifest decoded pixel hash is invalid")
    if not _is_hex(qa.get("perceptual_dhash"), _HEX_16):
        raise ValueError("manifest perceptual hash is invalid")
    if type(qa.get("near_duplicate_warning")) is not bool:
        raise ValueError("manifest near-duplicate warning is invalid")
    nearest = qa.get("nearest_perceptual_hamming_distance")
    if nearest is not None and (type(nearest) is not int or not 0 <= cast(int, nearest) <= 64):
        raise ValueError("manifest perceptual distance is invalid")
    checks = _required_mapping(
        qa.get("checks"),
        "qa.checks",
        {
            "format",
            "periodicity",
            "forward_correspondence",
            "depth_recovery",
            "normal_view_leakage",
            "exact_uniqueness",
        },
    )
    if any(value is not True for value in checks.values()):
        raise ValueError("manifest QA checks must all be true")
    return spec, depth_map_id, outputs, qa


def _rebuild_manifest_derivation(
    manifest: Mapping[str, object],
    spec: RenderSpec,
    config: AutostereogramConfig,
) -> tuple[Image.Image, Any]:
    try:
        source_data = _required_mapping(manifest.get("source"), "source")
        source_path = cast(str, source_data["source_path"])
        packet = build_article_packet(config.root / source_path, root=config.root, config=config)
        expected_source = {
            "article_id": packet.article_id,
            "source_path": Path(packet.source_path).as_posix(),
            "source_sha256": packet.source_sha256,
            "workflow_stage": packet.workflow_stage,
            "publishable": packet.publishable,
        }
        if dict(source_data) != expected_source:
            raise ValueError("manifest source does not match the current repository source")

        analysis = analyse_article(packet, config)
        expected_analysis = {
            "primary_topic": analysis.primary_topic,
            "matched_terms": list(analysis.matched_terms),
            "confidence": analysis.confidence,
            "method": analysis.method,
            "safety_constraints": list(analysis.safety_constraints),
        }
        if manifest.get("analysis") != expected_analysis:
            raise ValueError("manifest analysis is not derived from the current source")

        selection_data = _required_mapping(manifest.get("selection"), "selection")
        seed = derive_article_seed(
            packet,
            config.renderer_version,
            variant_number=spec.variant_number,
        )
        selection = select_hidden_object(
            packet,
            analysis,
            config,
            seed=seed,
        )
        expected_selection = {
            "hidden_object_id": selection.hidden_object_id,
            "depth_map_id": selection.depth_map_id,
            "alt_label": selection.alt_label,
            "reason": selection.selection_reason,
            "confidence": selection.confidence,
        }
        if dict(selection_data) != expected_selection:
            raise ValueError("manifest selection is not derived from the current source")

        expected_spec = build_render_spec(
            packet,
            analysis,
            selection,
            config,
            seed=seed,
            variant_number=spec.variant_number,
        )
        if expected_spec != spec:
            raise ValueError("render specification is not derived from the current source")
        depth = generate_depth_map(selection.depth_map_id, config)
        return render_autostereogram(depth, expected_spec, config), depth
    except (KeyError, TypeError, ValueError, OSError) as exc:
        raise CandidateOutputError("manifest derivation could not be verified") from exc


def validate_candidate_file(
    image_path: Path,
    *,
    config: AutostereogramConfig,
) -> dict[str, object]:
    """Re-run QA against an encoded candidate without writing or mutating it."""
    with _candidate_root_lock(config, exclusive=False) as root_descriptor:
        return _validate_candidate_file_locked(
            image_path,
            config=config,
            root_descriptor=root_descriptor,
        )


def _validate_candidate_file_locked(
    image_path: Path,
    *,
    config: AutostereogramConfig,
    root_descriptor: int,
) -> dict[str, object]:
    image_path = image_path if image_path.is_absolute() else config.root / image_path
    resolved = _validate_private_output(
        image_path.parent,
        config.candidate_root,
        config.root,
    ) / image_path.name
    manifest_path = resolved.with_suffix(".render.json")
    directory_descriptor = _open_child_directory(
        root_descriptor,
        resolved.parent.name,
        create=False,
    )
    try:
        _assert_path_identity(config.candidate_root, root_descriptor)
        _assert_child_identity(root_descriptor, resolved.parent.name, directory_descriptor)
        image_bytes = _read_regular_file(
            directory_descriptor,
            resolved.name,
            maximum_bytes=64_000_000,
        )
        manifest_bytes = _read_regular_file(
            directory_descriptor,
            manifest_path.name,
            maximum_bytes=1_000_000,
        )
        _assert_path_identity(config.candidate_root, root_descriptor)
        _assert_child_identity(root_descriptor, resolved.parent.name, directory_descriptor)
    finally:
        os.close(directory_descriptor)
    try:
        manifest = json.loads(manifest_bytes.decode("utf-8"))
        spec, _depth_map_id, outputs, manifest_qa = _validated_manifest(manifest, resolved, config)
    except (KeyError, TypeError, ValueError, UnicodeError, json.JSONDecodeError) as exc:
        raise CandidateOutputError(f"invalid render manifest: {manifest_path}") from exc
    expected_image, depth = _rebuild_manifest_derivation(manifest, spec, config)
    with Image.open(io.BytesIO(image_bytes)) as opened:
        expected_format = "PNG" if resolved.suffix.casefold() == ".png" else "WEBP"
        if opened.size != (config.width, config.height) or opened.format != expected_format:
            raise CandidateOutputError("encoded candidate dimensions or format do not match its filename")
        opened.load()
        image = opened.copy()
    pixel_hashes, perceptual_hashes = _existing_hashes_at(
        root_descriptor,
        exclude_article=resolved.parent.name,
        exclude_filename=resolved.with_suffix(".qa.json").name,
    )
    _assert_path_identity(config.candidate_root, root_descriptor)
    report = validate_autostereogram(
        image,
        depth,
        spec,
        existing_pixel_hashes=pixel_hashes,
        existing_perceptual_hashes=perceptual_hashes,
    )
    format_name = resolved.suffix.lstrip(".").casefold()
    output_record = outputs.get(format_name)
    expected_encoded_hash = output_record.get("sha256") if isinstance(output_record, dict) else None
    expected_encoded_bytes = output_record.get("bytes") if isinstance(output_record, dict) else None
    actual_encoded_hash = hashlib.sha256(image_bytes).hexdigest()
    actual_encoded_bytes = len(image_bytes)
    encoded_matches = expected_encoded_hash == actual_encoded_hash
    size_matches = expected_encoded_bytes == actual_encoded_bytes
    decoded_hash_matches = report.get("decoded_pixel_sha256") == manifest_qa.get("decoded_pixel_sha256")
    perceptual_hash_matches = report.get("perceptual_dhash") == manifest_qa.get("perceptual_dhash")
    deterministic_render_matches = hashlib.sha256(image.tobytes()).digest() == hashlib.sha256(
        expected_image.tobytes()
    ).digest()
    report["encoded_file_sha256"] = actual_encoded_hash
    report["encoded_file_bytes"] = actual_encoded_bytes
    report["encoded_file_hash_matches_manifest"] = encoded_matches
    report["encoded_file_size_matches_manifest"] = size_matches
    report["decoded_pixel_hash_matches_manifest"] = decoded_hash_matches
    report["perceptual_hash_matches_manifest"] = perceptual_hash_matches
    report["deterministic_render_matches_source"] = deterministic_render_matches
    report["passed"] = (
        bool(report.get("passed"))
        and encoded_matches
        and size_matches
        and decoded_hash_matches
        and perceptual_hash_matches
        and deterministic_render_matches
    )
    return report
