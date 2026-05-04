-- Stored Procedure para listar composición de un palet
CREATE PROCEDURE [dbo].[SP_Test_Palets_Composicion_Listar]
    @PaletId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        pc.Id,
        pc.PaletId,
        pc.ClienteId,
        pc.ConsignatarioId,
        pc.DestinoId,
        pc.FormatoId,
        pc.TipoEmpaqueId,
        pc.CalibreId,
        pc.VariedadId,
        pc.LugarProduccionId,
        pc.CodigoRanchoId,
        pc.TransporteId,
        pc.CantidadCajas,
        pc.PesoPorCaja,
        pc.PesoTotal,
        pc.EsReposicion,
        pc.EsEnsayo,
        pc.FechaCreacion,
        c.RazonSocial AS ClienteNombre,
        con.RazonSocial AS ConsignatarioNombre,
        d.Nombre AS DestinoNombre,
        f.Descripcion AS FormatoNombre,
        te.Descripcion AS TipoEmpaqueNombre,
        teg.Nombre AS TipoEmpaqueGuiaNombre,
        tpe.Codigo AS TipoProcesoEmpacadoCodigo,
        p.Nombre AS Presentacion,
        cal.Nombre AS CalibreNombre,
        v.Nombre AS VariedadNombre,
        lp.Codigo AS LugarProduccionCodigo,
        cr.Codigo AS CodigoRancho,
        t.Nombre AS TransporteNombre,
        CASE 
            WHEN pc.EsReposicion = 1 THEN 0
            WHEN pc.EsEnsayo = 1 THEN 0
            ELSE 1
        END AS EditablePorTipo,
        pc.GuiaBloqueanteId
    FROM 
        PaletComposicion pc
        LEFT JOIN Clientes c ON pc.ClienteId = c.Id
        LEFT JOIN Consignatarios con ON pc.ConsignatarioId = con.Id
        LEFT JOIN Destinos d ON pc.DestinoId = d.Id
        LEFT JOIN Formatos f ON pc.FormatoId = f.Id
        LEFT JOIN TiposEmpaque te ON pc.TipoEmpaqueId = te.Id
        LEFT JOIN TiposEmpaqueGuia teg ON pc.TipoEmpaqueGuiaId = teg.Id
        LEFT JOIN TiposProcesoEmpacado tpe ON pc.TipoProcesoEmpacadoId = tpe.Id
        LEFT JOIN Presentaciones p ON pc.PresentacionId = p.Id
        LEFT JOIN Calibres cal ON pc.CalibreId = cal.Id
        LEFT JOIN Variedades v ON pc.VariedadId = v.Id
        LEFT JOIN LugaresProduccion lp ON pc.LugarProduccionId = lp.Id
        LEFT JOIN CodigosRancho cr ON pc.CodigoRanchoId = cr.Id
        LEFT JOIN Transportes t ON pc.TransporteId = t.Id
    WHERE 
        pc.PaletId = @PaletId
    ORDER BY 
        pc.FechaCreacion DESC;
END
