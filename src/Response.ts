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
interface ResponseObject extends ResponseIter<ResponseObject> {}

export type Response = ResponseObject
