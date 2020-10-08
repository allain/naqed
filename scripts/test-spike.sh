#!/bin/bash

find ./test -name "*.test.ts" | while read test_path; do
    src_path=${test_path/test/src}
    src_path=${src_path%.test.ts}.ts

    if [[ -e $src_path ]]; then
        src_file=${src_path##*/}
        ./node_modules/.bin/jest --coverage $test_path 2>&1 | grep $src_file
    fi
done
