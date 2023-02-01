from __future__ import annotations

from enum import Enum
from typing import Any, List, Optional, cast

from pydantic import BaseModel, Extra


class AST(BaseModel):
    class Config:
        extra = Extra.forbid

    def children(self) -> List[AST]:
        raise NotImplementedError("AST.children() not implemented")


class Expr(AST):
    pass


class BinaryOperationType(str, Enum):
    Add = "+"
    Sub = "-"
    Mult = "*"
    Div = "/"
    Mod = "%"


class BinaryOperation(Expr):
    left: Expr
    right: Expr
    op: BinaryOperationType

    def children(self) -> List[AST]:
        return cast(List[AST], [self.left, self.right])


class BooleanOperationType(str, Enum):
    And = "and"
    Or = "or"


# TODO: refactor to just ast.And and ast.Or classes for ease of use
class BooleanOperation(Expr):
    class Config:
        extra = Extra.forbid

    op: BooleanOperationType
    values: List[Expr]

    def children(self) -> List[AST]:
        return cast(List[AST], self.values)


class CompareOperationType(str, Enum):
    Eq = "=="
    NotEq = "!="
    Gt = ">"
    GtE = ">="
    Lt = "<"
    LtE = "<="
    Like = "like"
    ILike = "ilike"
    NotLike = "not like"
    NotILike = "not ilike"


class CompareOperation(Expr):
    left: Expr
    right: Expr
    op: CompareOperationType

    def children(self) -> List[AST]:
        return cast(List[AST], [self.left, self.right])


class NotOperation(Expr):
    expr: Expr

    def children(self) -> List[AST]:
        return cast(List[AST], [self.expr])


class Constant(Expr):
    value: Any


class FieldAccess(Expr):
    field: str


class FieldAccessChain(Expr):
    chain: List[str]


class Call(Expr):
    name: str
    args: List[Expr]

    def children(self) -> List[AST]:
        return cast(List[AST], self.args)


class SelectQuery(Expr):
    select: List[Expr]
    where: Optional[Expr] = None
    prewhere: Optional[Expr] = None
    having: Optional[Expr] = None
    group_by: Optional[List[Expr]] = None
    limit: Optional[int] = None
    offset: Optional[int] = None

    def children(self) -> List[AST]:
        return cast(
            List[AST],
            self.select
            + ([self.where] if self.where else [])
            + ([self.prewhere] if self.prewhere else [])
            + ([self.having] if self.having else [])
            + (self.group_by or []),
        )
