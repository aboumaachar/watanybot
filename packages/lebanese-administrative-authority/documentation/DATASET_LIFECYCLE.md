# Dataset Lifecycle

States: `candidate` -> `validated` -> `approved` -> `released` -> `superseded` or `rejected`.

`candidate` and `validated` assets are not production runtime assets. `rejected` assets are retained only for audit history. A superseded release remains immutable and readable for historical evidence, but new writes use the current approved release.
