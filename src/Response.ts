type OneOrArray<T> = T | T[]

type ResponseIter<T> = Record<
  string,
  | undefined
  | null
  | OneOrArray<number>
  | OneOrArray<string>
  | OneOrArray<boolean>
  | OneOrArray<TypeError>
  | OneOrArray<T>
>
export interface Response extends ResponseIter<Response> {}
