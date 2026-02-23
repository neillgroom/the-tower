const crypto = require('crypto');

function sha256(input) {
    return crypto.createHash('sha256').update(input).digest('hex');
}

function buildMerkleTree(hashes) {
    if (!hashes.length) return { root: null, tree: [] };
    if (hashes.length === 1) return { root: hashes[0], tree: [hashes] };

    const tree = [hashes.slice()];
    let level = hashes.slice();

    while (level.length > 1) {
        const next = [];
        for (let i = 0; i < level.length; i += 2) {
            if (i + 1 < level.length) {
                next.push(sha256(level[i] + level[i + 1]));
            } else {
                // Odd node: promote it
                next.push(sha256(level[i] + level[i]));
            }
        }
        tree.push(next);
        level = next;
    }

    return { root: level[0], tree };
}

function getMerkleProof(tree, index) {
    const proof = [];
    let idx = index;

    for (let level = 0; level < tree.length - 1; level++) {
        const isRight = idx % 2 === 1;
        const siblingIdx = isRight ? idx - 1 : idx + 1;
        const sibling = siblingIdx < tree[level].length
            ? tree[level][siblingIdx]
            : tree[level][idx]; // duplicate for odd

        proof.push({
            hash: sibling,
            position: isRight ? 'left' : 'right'
        });

        idx = Math.floor(idx / 2);
    }

    return proof;
}

function verifyMerkleProof(hash, proof, root) {
    let current = hash;
    for (const step of proof) {
        if (step.position === 'left') {
            current = sha256(step.hash + current);
        } else {
            current = sha256(current + step.hash);
        }
    }
    return current === root;
}

module.exports = { sha256, buildMerkleTree, getMerkleProof, verifyMerkleProof };
