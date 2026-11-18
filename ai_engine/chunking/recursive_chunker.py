from collections.abc import Sequence


DEFAULT_SEPARATORS = ("\n\n", "\n", " ", "")


def _split_recursive(
    text: str,
    chunk_size: int,
    separators: Sequence[str],
) -> list[str]:
    if len(text) <= chunk_size:
        return [text] if text else []

    separator = next(
        (sep for sep in separators if sep and sep in text),
        "",
    )

    if not separator:
        return [
            text[i:i + chunk_size]
            for i in range(0, len(text), chunk_size)
        ]

    parts = text.split(separator)
    result = []

    for index, part in enumerate(parts):
        if index < len(parts) - 1:
            part += separator

        if not part:
            continue

        if len(part) > chunk_size:
            result.extend(
                _split_recursive(
                    part,
                    chunk_size,
                    separators[1:],
                )
            )
        else:
            result.append(part)

    return result


def chunk_text(
    text: str,
    chunk_size: int = 1000,
    chunk_overlap: int = 150,
    separators: Sequence[str] = DEFAULT_SEPARATORS,
) -> list[str]:
    if chunk_size <= 0:
        raise ValueError("chunk_size must be greater than zero")

    if chunk_overlap < 0 or chunk_overlap >= chunk_size:
        raise ValueError(
            "chunk_overlap must be >= 0 and < chunk_size"
        )

    if not text or not text.strip():
        return []

    pieces = _split_recursive(
        text.strip(),
        chunk_size,
        separators,
    )

    chunks = []
    current = ""

    for piece in pieces:
        if len(current) + len(piece) <= chunk_size:
            current += piece
            continue

        if current:
            chunks.append(current.strip())

        overlap = current[-chunk_overlap:] if chunk_overlap else ""
        current = overlap + piece

        if len(current) > chunk_size:
            current = current[-chunk_size:]

    if current.strip():
        chunks.append(current.strip())

    return chunks
