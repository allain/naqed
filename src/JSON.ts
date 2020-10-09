type JSONObjectIter<T> = Record<
  string,
  | undefined
  | null
  | number
  | string
  | boolean
  | number[]
  | string[]
  | boolean[]
  | T
  | T[]
>
export interface JSONObject extends JSONObjectIter<JSONObject> {}

export type JSONValue =
  | null
  | number
  | string
  | boolean
  | number[]
  | string[]
  | boolean[]
  | JSONObject
  | JSONObject[]
